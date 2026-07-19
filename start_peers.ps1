Write-Host "Starting Sentinel Mesh P2P Mock Exchange Nodes..." -ForegroundColor Cyan

# Start Exchange Alpha on Port 8001
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "api/peer.py", '"Exchange Alpha"', "8001"
Write-Host "Launched Exchange Alpha (Port 8001)" -ForegroundColor Green

# Start Wallet Beta on Port 8002
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "api/peer.py", '"Wallet Beta"', "8002"
Write-Host "Launched Wallet Beta (Port 8002)" -ForegroundColor Green

# Start Exchange Gamma on Port 8003
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "api/peer.py", '"Protocol Gamma"', "8003"
Write-Host "Launched Protocol Gamma (Port 8003)" -ForegroundColor Green

# Start Node Delta on Port 8004
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "api/peer.py", '"Yield Farm Delta"', "8004"
Write-Host "Launched Yield Farm Delta (Port 8004)" -ForegroundColor Green

# Start Node Epsilon on Port 8005
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "api/peer.py", '"Bridge Node Epsilon"', "8005"
Write-Host "Launched Bridge Node Epsilon (Port 8005)" -ForegroundColor Green

# Start Node Zeta on Port 8006
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "api/peer.py", '"Custodian Zeta"', "8006"
Write-Host "Launched Custodian Zeta (Port 8006)" -ForegroundColor Green

Write-Host "All 6 P2P nodes are now running in the background." -ForegroundColor Yellow
Write-Host "You can now trigger the Zero-Knowledge KYC Ban from the frontend to see real network propagation!" -ForegroundColor White
