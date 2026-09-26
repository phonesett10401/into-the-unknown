import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

export const GATE_ADDRESS = process.env.NEXT_PUBLIC_GATE_ADDRESS || "0xd75564Df35299e5723D279157396bd7DB5C124f7";
export const hasContract = /^0x[0-9a-fA-F]{40}$/.test(GATE_ADDRESS);

const FUJI_ID = 43113;
const FUJI = {
  chainId: "0xa869",
  chainName: "Avalanche Fuji C-Chain",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://testnet.snowtrace.io"],
};
export const EXPLORER = FUJI.blockExplorerUrls[0];

const ABI = [
  "function clear(uint8 zone, string answer)",
  "function skip(uint8 zone) payable",
  "function skipFee() view returns (uint256)",
  "function passedMask(address) view returns (uint8)",
  "function badgeMask(address) view returns (uint8)",
  "function stats() view returns (uint32[5] cleared, uint32[5] skipped)",
];

let reader: Contract | null = null;
function readContract() {
  if (!reader) {
    const provider = new JsonRpcProvider(FUJI.rpcUrls[0], FUJI_ID, { staticNetwork: true });
    reader = new Contract(GATE_ADDRESS, ABI, provider);
  }
  return reader;
}

async function ensureFuji() {
  const eth = window.ethereum;
  if (!eth) throw new Error("NO_WALLET");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: FUJI.chainId }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [FUJI] });
    } else {
      throw e;
    }
  }
}

async function writeContract() {
  await ensureFuji();
  const signer = await new BrowserProvider(window.ethereum).getSigner();
  return new Contract(GATE_ADDRESS, ABI, signer);
}

export async function connect(): Promise<string> {
  if (!window.ethereum) throw new Error("NO_WALLET");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  await ensureFuji();
  const signer = await new BrowserProvider(window.ethereum).getSigner();
  return signer.getAddress();
}

export type TxResult = { hash: string; ms: number };

async function timed(send: Promise<{ hash: string; wait: () => Promise<unknown> }>): Promise<TxResult> {
  const tx = await send;
  const t0 = performance.now();
  await tx.wait();
  return { hash: tx.hash, ms: performance.now() - t0 };
}

export async function sendClear(zone: number, answer: string): Promise<TxResult> {
  const c = await writeContract();
  return timed(c.clear(zone, answer));
}

let feeCache: bigint | null = null;
export async function sendSkip(zone: number): Promise<TxResult> {
  if (feeCache === null) feeCache = (await readContract().skipFee()) as bigint;
  const c = await writeContract();
  return timed(c.skip(zone, { value: feeCache }));
}

export async function readDiver(addr: string): Promise<{ passed: number; badges: number }> {
  const c = readContract();
  const [p, b] = await Promise.all([c.passedMask(addr), c.badgeMask(addr)]);
  return { passed: Number(p), badges: Number(b) };
}

export async function readStats(): Promise<{ cleared: number[]; skipped: number[] }> {
  const [cleared, skipped] = (await readContract().stats()) as [bigint[], bigint[]];
  return { cleared: cleared.map(Number), skipped: skipped.map(Number) };
}

export function explainError(e: unknown): string {
  const err = e as { code?: string | number; message?: string; info?: { error?: { code?: number } } };
  if (err?.message === "NO_WALLET") return "No wallet found. Install MetaMask to go deeper.";
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001 || err?.info?.error?.code === 4001)
    return "Cancelled in the wallet.";
  if (err?.message?.toLowerCase().includes("insufficient funds")) return "Not enough Fuji AVAX for this.";
  if (err?.code === 4902 || err?.message?.toLowerCase().includes("chain")) return "Switch your wallet to Avalanche Fuji.";
  return "That did not go through. Try again.";
}
