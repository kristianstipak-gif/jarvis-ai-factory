export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export function buildMintAccountInfo(account) {
  const info = account?.data?.parsed?.info;
  if (!info) return null;

  return {
    mintAuthority: info.mintAuthority || null,
    freezeAuthority: info.freezeAuthority || null,
    decimals: Number.isFinite(info.decimals) ? info.decimals : null,
    supplyRaw: info.supply || null,
  };
}

export function buildMintRiskSignals(mintInfo = {}) {
  return {
    mintAuthorityActive: Boolean(mintInfo.mintAuthority),
    freezeAuthorityActive: Boolean(mintInfo.freezeAuthority),
    authorityRisk:
      (mintInfo.mintAuthority ? 1 : 0) +
      (mintInfo.freezeAuthority ? 1 : 0),
  };
}
