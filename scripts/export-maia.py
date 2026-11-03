#!/usr/bin/env python3
"""Export a Maia-3 checkpoint to the ONNX graph the app runs.

    python scripts/export-maia.py --checkpoint maia3-5m.pt --maia3 ../maia3 --out public/maia/maia3-5m.onnx

The graph takes the last eight positions as 96 piece planes, exactly as the Python engine builds
them: `MAIA3Model.forward` slices `12 * history` off the input, so the clock channel is dropped
before it reaches the network. Two details make the export work on a stock PyTorch:

- `nn.RMSNorm` has no ONNX lowering at opset 17, so it is replaced by the same arithmetic.
- the checkpoint may name its attention modules `smolgen`; upstream renames them to `gab`.

The export prints the SHA-256 of the checkpoint it read. Record it next to the model in CREDITS.md,
with the repository revision it came from: a downloaded `.pt` is only as good as what pins it.
"""

import argparse
import hashlib
import sys
import types

import chess
import numpy as np
import torch

PIECE_PLANES = {
    chess.PAWN: 1,
    chess.KNIGHT: 2,
    chess.BISHOP: 3,
    chess.ROOK: 4,
    chess.QUEEN: 5,
    chess.KING: 6,
}


class ManualRMSNorm(torch.nn.Module):
    """`nn.RMSNorm` exports only from a recent opset; this is the same arithmetic, decomposed."""

    def __init__(self, norm):
        super().__init__()
        self.weight = norm.weight
        self.eps = float(norm.eps) if norm.eps is not None else torch.finfo(torch.float32).eps

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight


class WithoutPonder(torch.nn.Module):
    """The two heads the app reads; the ponder clock is a training label."""

    def __init__(self, wrapped):
        super().__init__()
        self.wrapped = wrapped

    def forward(self, tokens, elo_self, elo_oppo):
        logits_move, logits_value, _ = self.wrapped(tokens, elo_self, elo_oppo)
        return logits_move, logits_value


def decompose_rms_norm(module):
    for name, child in module.named_children():
        if isinstance(child, torch.nn.RMSNorm):
            setattr(module, name, ManualRMSNorm(child))
        else:
            decompose_rms_norm(child)


def tokenize(board):
    """One position as 64 x 12 planes, Black mirrored to White's side, as upstream does."""
    tokens = torch.zeros((64, 12), dtype=torch.float32)
    if board.turn == chess.BLACK:
        board = board.mirror()
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            plane = PIECE_PLANES[piece.piece_type] + (6 if piece.color == chess.BLACK else 0)
            tokens[square][plane - 1] = 1.0
    return tokens


def history_tensor(history, fens):
    """The last `history` positions, oldest first, padded with the earliest, as upstream pads."""
    boards = [chess.Board(fen) for fen in fens][-history:]
    tokens = [tokenize(board) for board in boards]
    while len(tokens) < history:
        tokens.insert(0, tokens[0])
    return torch.cat(tokens, dim=1).unsqueeze(0)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", required=True, help="the .pt downloaded from HuggingFace")
    parser.add_argument("--maia3", required=True, help="a checkout of CSSLab/maia3")
    parser.add_argument("--out", required=True, help="where to write the .onnx")
    parser.add_argument("--size", default="maia3-5m", help="the registry alias: maia3-3m-ablation, maia3-5m, maia3-23m, maia3-79m")
    args = parser.parse_args()

    sys.path.insert(0, args.maia3)
    from maia3.model_registry import BASE_SIZE_CONFIG, MODEL_SPECS
    from maia3.models import MAIA3Model

    spec = next(spec for spec in MODEL_SPECS if spec.name == args.size)
    config = {**BASE_SIZE_CONFIG, **spec.config}
    config.update(
        device="cpu",
        checkpoint_path=args.checkpoint,
        trust_checkpoint=False,
        use_padding=False,
    )
    cfg = types.SimpleNamespace(**config)

    model = MAIA3Model(cfg).to("cpu")
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    state = checkpoint["model_state_dict"] if "model_state_dict" in checkpoint else checkpoint
    state = {key.replace("smolgen", "gab"): value for key, value in state.items()}
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing or unexpected:
        raise SystemExit(f"checkpoint does not fit: missing {missing[:5]} unexpected {unexpected[:5]}")
    model.eval()
    decompose_rms_norm(model)

    wrapped = WithoutPonder(model).eval()
    sample = history_tensor(
        cfg.history, ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
    )
    elo_self = torch.tensor([1500.0])
    elo_oppo = torch.tensor([1500.0])

    with torch.no_grad():
        reference_move, reference_value = wrapped(sample, elo_self, elo_oppo)

    torch.onnx.export(
        wrapped,
        (sample, elo_self, elo_oppo),
        args.out,
        input_names=["tokens", "elo_self", "elo_oppo"],
        output_names=["logits_move", "logits_value"],
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )

    import onnxruntime as ort

    session = ort.InferenceSession(args.out, providers=["CPUExecutionProvider"])
    onnx_move, onnx_value = session.run(
        None,
        {"tokens": sample.numpy(), "elo_self": elo_self.numpy(), "elo_oppo": elo_oppo.numpy()},
    )
    move_delta = float(np.abs(onnx_move - reference_move.numpy()).max())
    value_delta = float(np.abs(onnx_value - reference_value.numpy()).max())
    print(f"onnx against torch: move logits {move_delta:.2e}, value {value_delta:.2e}")
    if move_delta > 1e-2 or value_delta > 1e-2:
        raise SystemExit("the exported graph does not match PyTorch")

    with open(args.checkpoint, "rb") as handle:
        print("checkpoint sha256", hashlib.sha256(handle.read()).hexdigest())


if __name__ == "__main__":
    main()
