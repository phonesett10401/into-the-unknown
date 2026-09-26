# Deploy DepthGate to Fuji via Remix + MetaMask

1. MetaMask: switch network to **Avalanche Fuji C-Chain** (chain ID 43113).
2. Open https://remix.ethereum.org → new file `DepthGate.sol` → paste
   `contracts/src/DepthGate.sol` in full.
3. Solidity compiler tab: version **0.8.24 or newer** → Compile.
4. Deploy tab: Environment **Injected Provider - MetaMask**. Confirm it shows
   `Custom (43113) network`.
5. Contract: `DepthGate`. Expand the Deploy arguments and paste exactly:

| Argument | Value |
|---|---|
| `_skipFee` | `1000000000000000` |
| `_salt` | `0x5188cb90642de1c5fe279bafe5fad2f456fb6027d845bb10cc474d6a276968bd` |
| `hashes` | see below |

```
["0xc6d6d76817daef481795dae8ae80528ccc68190ea0838268f2b212170375f6d7","0xd41850726337c6270116589b390eed228e6333e5a21fe1a5a66a03d0515530db","0x724f13f748c31c6487d2a5849cc96bb2ed6c335ececaf788f7d21d198d358a3f","0x88c7951a71d6596ba2dd41e9adfb85d1eedb11a8c8e572f812343105ec483829","0xbf3dca1e5254fcc81042b7b9df8b0636ff6069caeca990a8d86826c71c71b739"]
```

6. Transact → confirm in MetaMask.
7. Copy the deployed contract address from "Deployed Contracts" and send it.

Skip fee is 0.001 AVAX. Hashes are `keccak256(abi.encodePacked(uint8 zone, string answer, bytes32 salt))`
for the five answers in `quiz.json`; regenerate with `forge script script/Hashes.s.sol`.
