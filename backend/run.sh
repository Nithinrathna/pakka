#!/bin/bash

# Run all backends in background within the same terminal session
python app.py &
python speech.py &
python text.py &
python server.py &

# Optional: Wait for all to complete (if you want to keep the script running)
wait
