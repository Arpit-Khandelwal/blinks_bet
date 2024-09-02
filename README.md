# Solana Coin Flip Blink

## Description
This project provides a blink for a coin flip game on the Solana blockchain. It allows users to place bets and determine the outcome of a coin flip.

## Installation

1. Clone the repository

2. Install the dependencies:
    ```sh
    npm install
    ```

3. Set up environment variables:
    Create a `.env` file in the root directory and add the necessary environment variables.

## Usage

1. Start the server:
    ```sh
    npm start
    ```

2. The API will be available at `http://localhost:3000`.

## API Endpoints

Blink would be available at localhost:3000/api/actions

### GET /flip
Initiates a coin flip.

#### Request
- Headers: 
  - `Content-Type: application/json`

#### Response
- `200 OK`: Returns the result of the coin flip.
  ```json
  {
    "result": "Heads" | "Tails"
  }
