import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum

from backend.main import app

# Vercel calls this as the serverless entry point
handler = Mangum(app, lifespan="off")
