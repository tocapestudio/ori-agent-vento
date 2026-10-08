"""Persisted on-disk vector index (exact cosine search, numpy). Mongo keeps embeddings as rebuild source."""
import json
import logging
import os
import threading
import time
from pathlib import Path

import numpy as np


def _replace(src, dst):
    for i in range(6):  # Windows: antivirus/indexer may briefly lock the target
        try:
            return os.replace(src, dst)
        except PermissionError:
            if i == 5:
                raise
            time.sleep(0.3 * (i + 1))


class VectorIndex:
    def __init__(self, directory: str):
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.vecs = np.zeros((0, 0), dtype=np.float32)
        self.meta: list = []
        try:
            if (self.dir / "vectors.npy").exists() and (self.dir / "meta.json").exists():
                self.vecs = np.load(self.dir / "vectors.npy")
                self.meta = json.loads((self.dir / "meta.json").read_text(encoding="utf-8"))
                if len(self.meta) != len(self.vecs):
                    raise ValueError("vectors/meta size mismatch")
        except Exception:  # noqa: BLE001 - corrupt index: start empty, startup sync rebuilds it from Mongo
            logging.getLogger("ori.index").exception("Índice vectorial dañado; se reconstruirá")
            self.vecs, self.meta = np.zeros((0, 0), dtype=np.float32), []

    def __len__(self):
        return len(self.meta)

    def _save(self):
        np.save(self.dir / "vectors.tmp.npy", self.vecs)
        _replace(self.dir / "vectors.tmp.npy", self.dir / "vectors.npy")
        (self.dir / "meta.tmp.json").write_text(json.dumps(self.meta), encoding="utf-8")
        _replace(self.dir / "meta.tmp.json", self.dir / "meta.json")

    @staticmethod
    def _norm(vectors):
        arr = np.asarray(vectors, dtype=np.float32)
        return arr / (np.linalg.norm(arr, axis=1, keepdims=True) + 1e-9)

    def reset(self, entries, vectors):
        with self.lock:
            self.meta = list(entries)
            self.vecs = self._norm(vectors) if len(entries) else np.zeros((0, 0), dtype=np.float32)
            self._save()

    def add(self, entries, vectors):
        if not entries:
            return
        new = self._norm(vectors)
        with self.lock:
            self.vecs = new if len(self.meta) == 0 else np.vstack([self.vecs, new])
            self.meta.extend(entries)
            self._save()

    def remove(self, predicate):
        with self.lock:
            keep = [i for i, m in enumerate(self.meta) if not predicate(m)]
            if len(keep) == len(self.meta):
                return
            self.meta = [self.meta[i] for i in keep]
            self.vecs = self.vecs[keep] if keep else np.zeros((0, 0), dtype=np.float32)
            self._save()

    def search(self, query_vec, scopes: set, k: int = 40):
        with self.lock:
            if not self.meta:
                return []
            mask = np.array([m["scope"] in scopes for m in self.meta])
            if not mask.any():
                return []
            q = self._norm([query_vec])[0]
            scores = np.where(mask, self.vecs @ q, -2.0)
            top = np.argsort(-scores)[:k]
            return [(self.meta[i]["chunk_id"], float(scores[i])) for i in top if scores[i] > -2.0]
