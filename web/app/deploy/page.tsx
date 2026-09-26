"use client";

import { useState } from "react";
import { BrowserProvider, ContractFactory } from "ethers";
import artifact from "@/lib/DepthGate.artifact.json";
import { EXPLORER, connect, explainError } from "@/lib/chain";

// Deploy helper for the owner. Same arguments as DEPLOY.md.
const SKIP_FEE = 1000000000000000n;
const SALT = "0x5188cb90642de1c5fe279bafe5fad2f456fb6027d845bb10cc474d6a276968bd";
const HASHES = [
  "0xc6d6d76817daef481795dae8ae80528ccc68190ea0838268f2b212170375f6d7",
  "0xd41850726337c6270116589b390eed228e6333e5a21fe1a5a66a03d0515530db",
  "0x724f13f748c31c6487d2a5849cc96bb2ed6c335ececaf788f7d21d198d358a3f",
  "0x88c7951a71d6596ba2dd41e9adfb85d1eedb11a8c8e572f812343105ec483829",
  "0xbf3dca1e5254fcc81042b7b9df8b0636ff6069caeca990a8d86826c71c71b739",
];

export default function Deploy() {
  const [status, setStatus] = useState("Not deployed.");
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function deploy() {
    setBusy(true);
    try {
      setStatus("Connecting and switching to Fuji…");
      const from = await connect();
      setStatus(`Deploying from ${from}. Confirm in MetaMask…`);
      const signer = await new BrowserProvider(window.ethereum).getSigner();
      const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
      const contract = await factory.deploy(SKIP_FEE, SALT, HASHES);
      setStatus("Waiting for Fuji to finalise…");
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      setAddress(addr);
      setStatus("Deployed.");
    } catch (e) {
      setStatus(explainError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "15vh auto", padding: "0 16px" }}>
      <p className="kicker">Owner tool · Avalanche Fuji</p>
      <h2>Deploy DepthGate</h2>
      <p>{status}</p>
      {address && (
        <p style={{ fontFamily: "var(--mono)", wordBreak: "break-all", color: "var(--gold)" }}>
          {address}{" "}
          <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer" style={{ color: "var(--glow)" }}>
            view
          </a>
        </p>
      )}
      <button className="again" onClick={deploy} disabled={busy || !!address}>
        {busy ? "Working…" : "Deploy to Fuji"}
      </button>
    </main>
  );
}
