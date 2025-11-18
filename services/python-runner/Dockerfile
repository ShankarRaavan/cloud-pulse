FROM python:3.9-slim-bullseye

RUN apt-get update && apt-get install -y python3-distutils

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "app.py"]
