FROM python:3.9-slim-bullseye

WORKDIR /app

# Install git for GitHub integration
RUN apt-get update && \
    apt-get install -y git python3-distutils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create logs directory
RUN mkdir -p /app/logs

# Create a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
