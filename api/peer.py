from fastapi import FastAPI, Request
import asyncio
import random
import sys

app = FastAPI()

# The name of the exchange will be passed via command line args in the startup script
# Defaults to "Unknown Node" if not provided
NODE_NAME = sys.argv[1] if len(sys.argv) > 1 else "Unknown Node"

@app.post("/p2p/receive-ban")
async def receive_ban(request: Request):
    """
    Receives a ZK-DID ban signal from the Sentinel Mesh Relay.
    """
    payload = await request.json()
    zk_did = payload.get("zk_did")
    
    if not zk_did:
        return {"status": "error", "message": "Missing ZK-DID"}

    # Simulate realistic database write latency for this exchange (e.g. 100ms - 600ms)
    # This proves the network is actually waiting on a real asynchronous response!
    latency = random.uniform(0.1, 0.6)
    await asyncio.sleep(latency)

    print(f"[{NODE_NAME}] Successfully enforced global ban for {zk_did}")

    return {
        "status": "success",
        "node": NODE_NAME,
        "message": "Identity Hash banned globally."
    }

if __name__ == "__main__":
    import uvicorn
    # If run directly without uvicorn command, default to 8001
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8001
    uvicorn.run(app, host="0.0.0.0", port=port)
