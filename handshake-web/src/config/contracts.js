export function getEscrowContractConfig(activeConfigOrContracts) {
  const contracts = activeConfigOrContracts?.contracts ?? activeConfigOrContracts;

  if (!contracts) {
    return null;
  }

  return contracts.SecureHandshakeUnlimitedInbox || contracts.EscrowProxy || null;
}
