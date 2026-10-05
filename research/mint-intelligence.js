export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_FUN_MINT_AUTHORITY = "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM";
export const PUMPSWAP_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";

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

export function isLikelyPumpFunMint(mintInfo = {}) {
  return mintInfo.mintAuthority === PUMP_FUN_MINT_AUTHORITY;
}

export function buildMintRiskSignals(mintInfo = {}) {
  return {
    mintAuthorityActive: Boolean(mintInfo.mintAuthority),
    freezeAuthorityActive: Boolean(mintInfo.freezeAuthority),
    pumpFunMintAuthority: isLikelyPumpFunMint(mintInfo),
    authorityRisk:
      (mintInfo.mintAuthority ? 1 : 0) +
      (mintInfo.freezeAuthority ? 1 : 0),
  };
}
