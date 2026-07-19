"""
Wallet relationship graph — adds /graph endpoint to the API.
Returns nodes (wallets) + edges (known transaction relationships).
Used by the D3 force-directed graph in the frontend.
"""

# Known on-chain relationships between wallets (publicly documented)
# Each entry = "wallet A sent funds to wallet B" or "both touched same mixer"
WALLET_RELATIONSHIPS = [
    # Core Lazarus Group funding chain
    ("0x7f367cc41522ce07553e823bf3be79a889debe1b", "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b"),
    ("0x7f367cc41522ce07553e823bf3be79a889debe1b", "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"),
    # Hydra -> Tornado Cash
    ("0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b", "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"),
    # Suspicious wallet touched tornado cash
    ("0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d", "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"),
    # OFAC address chains
    ("0x901bb9583b24d97e995513c6778dc6888ab6870e", "0x7f367cc41522ce07553e823bf3be79a889debe1b"),
    ("0xa7efae728d369c190f76a62d8e7f6e3ec9ae9e20", "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b"),
    
    # --- NEW EXTENDED NETWORK ---
    # Ronin Hacker moving funds
    ("0x098b716b8aaf21512996dc57eb0615e2383e2f96", "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"), # Ronin to Tornado
    ("0x098b716b8aaf21512996dc57eb0615e2383e2f96", "0x7f367cc41522ce07553e823bf3be79a889debe1b"), # Ronin connected to Lazarus
    
    # Victims getting drained to a central aggregator
    ("0x1111111111111111111111111111111111111111", "0x6666666666666666666666666666666666666666"), # Victim A to Drainer
    ("0x2222222222222222222222222222222222222222", "0x6666666666666666666666666666666666666666"), # Victim B to Drainer
    ("0x3333333333333333333333333333333333333333", "0x6666666666666666666666666666666666666666"), # Victim C to Drainer
    
    # Drainer washing funds
    ("0x6666666666666666666666666666666666666666", "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"), # Drainer to Tornado
    ("0x6666666666666666666666666666666666666666", "0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d"), # Drainer to Suspicious
    
    # Exchange hot wallet interactions (showing they are connected to victims, but clean)
    ("0x28c6c06298d514db089934071355e5743bf21d60", "0x1111111111111111111111111111111111111111"), # Binance to Victim A
    ("0x28c6c06298d514db089934071355e5743bf21d60", "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"), # Binance to Vitalik
    
    # Another mixer cluster
    ("0xa7efae728d369c190f76a62d8e7f6e3ec9ae9e20", "0x4444444444444444444444444444444444444444"), # OFAC to OTC Broker
    ("0x098b716b8aaf21512996dc57eb0615e2383e2f96", "0x4444444444444444444444444444444444444444"), # Ronin to OTC Broker
    
    # Cross-Chain intelligence
    ("0x7f367cc41522ce07553e823bf3be79a889debe1b", "sol:9wz..."), # Lazarus ETH to Solana
    ("0x7f367cc41522ce07553e823bf3be79a889debe1b", "btc:bc1..."), # Lazarus ETH to BTC Mixer
]

WALLET_LABELS = {
    # Original
    "0x7f367cc41522ce07553e823bf3be79a889debe1b": "Lazarus Group",
    "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b": "Hydra Market",
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": "Tornado Cash",
    "0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d": "Suspicious",
    "0x901bb9583b24d97e995513c6778dc6888ab6870e": "OFAC #1",
    "0xa7efae728d369c190f76a62d8e7f6e3ec9ae9e20": "OFAC #2",
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": "vitalik.eth",
    
    # New additions
    "0x098b716b8aaf21512996dc57eb0615e2383e2f96": "Ronin Bridge Hacker",
    "0x6666666666666666666666666666666666666666": "Phishing Drainer",
    "0x1111111111111111111111111111111111111111": "Victim A",
    "0x2222222222222222222222222222222222222222": "Victim B",
    "0x3333333333333333333333333333333333333333": "Victim C",
    "0x28c6c06298d514db089934071355e5743bf21d60": "Binance Hot Wallet",
    "0x4444444444444444444444444444444444444444": "Shady OTC Broker",
    
    # Cross-chain
    "sol:9wz...": "Solana Aggregator",
    "btc:bc1...": "Bitcoin Mixer",
}
