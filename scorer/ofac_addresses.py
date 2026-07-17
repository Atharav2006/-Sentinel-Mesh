# OFAC Sanctioned & publicly known malicious addresses
# Source: US Treasury SDN List + Chainalysis public data

OFAC_SANCTIONED = {
    "0x7f367cc41522ce07553e823bf3be79a889debe1b",  # Lazarus Group (North Korea)
    "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b",  # Hydra marketplace
    "0x901bb9583b24d97e995513c6778dc6888ab6870e",  # OFAC sanctioned
    "0xa7efae728d369c190f76a62d8e7f6e3ec9ae9e20",  # OFAC sanctioned
    "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a",  # OFAC sanctioned
    "0x9f4cda013e354b8fc285bf4b9a60460cee7f7ea9",  # OFAC sanctioned
    "0x53903d57d68cb37af0f9cc599a9878897916b0d7",  # OFAC sanctioned
}

KNOWN_MIXERS = {
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",  # Tornado Cash Router
    "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",  # Tornado Cash
    "0xa160cdab225685da1d56aa342ad8841c3b53f291",  # Tornado Cash
    "0x722122df12d4e14e13ac3b6895a86e84145b6967",  # Tornado Cash
    "0xdd4c48c0b24039969fc16d1cdf626eab821d3384",  # Tornado Cash
}

CLEAN_REFERENCE = {
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",  # vitalik.eth
    "0x00000000219ab540356cbb839cbe05303d7705fa",  # ETH2 deposit contract
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",  # WETH contract
}

def is_ofac_sanctioned(address: str) -> bool:
    return address.lower() in OFAC_SANCTIONED

def is_known_mixer(address: str) -> bool:
    return address.lower() in KNOWN_MIXERS

def is_clean_reference(address: str) -> bool:
    return address.lower() in CLEAN_REFERENCE
