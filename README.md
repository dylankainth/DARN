# Distributed AI Ranked Network

AKA DARN IT!


![DARN IT](https://y.yarn.co/1bd7d91c-5135-46d9-9700-f7a583f2115d_text.gif)

## Prereqs
- Install Python
- Install Node.js

## How to run it?

0. Make a venv, install Node.js packages, install python packages, set up .env

```python -m venv venv```

```pip install -r requirements.txt```

```cd web```, ```npm install```

rename ```/web/.env.example``` -> ```/web/.env`
rename ```.env.example``` -> ```.env```

Fill in your shodan API key from the [shodan console](https://shodan.io).

1. Run the script to go grab some data
(make sure you are using a vpn first)
```python main.py```

2. Run the FastAPI Python Backend

```pip install requirements.txt```

```python -m fastapi dev main.py```

3. (In a seperate CMD window), Run the React-Vite Frontend Dashboard

```cd web```

```npm run dev```

## How to use?
Open ```localhost:5173```
