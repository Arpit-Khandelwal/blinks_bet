import {
  ActionPostResponse,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
} from "@solana/actions";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";

const headers = createActionHeaders({
  chainId: "devnet",
  actionVersion: "2.2.1",
});

const coin = {
  H: "Heads",
  T: "Tails",
};

const DEFAULT_BET_AMOUNT = 0.01;

export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { toPubkey } = validatedQueryParams(requestUrl);

    const baseHref = new URL(
      `/api/actions?to=${toPubkey.toBase58()}`,
      requestUrl.origin
    ).toString();

    const payload: ActionGetResponse = {
      type: "action",
      title: "Guess Heads/Tails ",
      icon: new URL("/coin-flip.jpeg", requestUrl.origin).toString(),
      description: "Bet on a coin flip. Double your money on winning",
      label: "Transfer", // this value will be ignored since `links.actions` exists
      links: {
        actions: [
          {
            label: "0.01 on Heads",
            href: `${baseHref}&amount=${DEFAULT_BET_AMOUNT}&wager=H`,
          },

          {
            label: "0.01 on Tails",
            href: `${baseHref}&amount=${DEFAULT_BET_AMOUNT}&wager=T`,
          },

            // {
            //   label: "Bet " + DEFAULT_BET_AMOUNT + " SOL", // button text
            //   href: `${baseHref}&amount=${DEFAULT_BET_AMOUNT}&wager={wager}`, // this href will have a text input
            //   parameters: [
            //     {
            //       type: "radio",
            //       name: "wager", // parameter name in the `href` above
            //       label: "Bet on: ", // placeholder of the text input
            //       required: true,
            //       options: [
            //         { label: "Heads", value: "H" },
            //         { label: "Tails", value: "T" },
            //       ],
            //     },
            //   ],
            // },
            // {
            //   label: "Bet SOL", // button text
            //   href: `${baseHref}&amount={amount}&wager={wager}`, // this href will have a text input
            //   parameters: [
            //     {
            //       type: "radio",
            //       name: "wager", // parameter name in the `href` above
            //       label: "Bet on: ", // placeholder of the text input
            //       required: true,
            //       options: [
            //         { label: "Heads", value: "H" },
            //         { label: "Tails", value: "T" },
            //       ],
            //     },
            //     {
            //       type: "number",
            //       name: "amount",
            //       label: "Amount",
            //       required: true,
            //     },
            //   ],
            // },
        ],
      },
    };

    return Response.json(payload, {
      headers,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers,
    });
  }
};

export const OPTIONS = async (req: Request) => {
  return new Response(null, { headers });
};

export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { amount, toPubkey, wager } = validatedQueryParams(requestUrl);

    const body: ActionPostRequest = await req.json();

    console.log("\n\n\ninside POST: \n Req url:", req.url);
    console.log("decoded req:", { amount, toPubkey, wager });
    console.log("Body:", JSON.stringify(body));

    // validate the client provided input
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers,
      });
    }

    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl("devnet")
    );

    // ensure the receiving account will be rent exempt
    const minimumBalance = await connection.getMinimumBalanceForRentExemption(
      0 // note: simple accounts that just store native SOL have `0` bytes of data
    );
    if (amount * LAMPORTS_PER_SOL < minimumBalance) {
      throw `account may not be rent exempt: ${toPubkey.toBase58()}`;
    }

    // create an instruction to transfer native SOL from one wallet to another
    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: toPubkey,
      lamports: amount * LAMPORTS_PER_SOL,
    });

    // get the latest blockhash amd block height
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    // create a legacy transaction
    const transaction = new Transaction({
      feePayer: account,
      blockhash,
      lastValidBlockHeight,
    }).add(transferSolInstruction);



    // versioned transactions are also supported
    // const transaction = new VersionedTransaction(
    //   new TransactionMessage({
    //     payerKey: account,
    //     recentBlockhash: blockhash,
    //     instructions: [transferSolInstruction],
    //   }).compileToV0Message(),
    //   // note: you can also use `compileToLegacyMessage`
    // );

    // keep current winnings of user in memory, or to KV pair (wallet:amount)
    // show a withdraw button that will send winning amount from Master wallet to user wallet

    const result = gamble(wager);
    const baseHref = new URL(
      `/api/actions?to=${toPubkey.toBase58()}`,
      requestUrl.origin
    ).toString();

    let nextAction: ActionGetResponse = {
      type: "action",
      icon: new URL("/coin-flip.jpeg", requestUrl.origin).toString(),
      label: "bet-result",
      title: "Bet Result",
      disabled: false,
      description: "Bet more?",
      links: {
        actions: [
          {
            label: "0.01 on Heads",
            href: `${baseHref}&amount=${DEFAULT_BET_AMOUNT}&wager=H`,
          },

          {
            label: "0.01 on Tails",
            href: `${baseHref}&amount=${DEFAULT_BET_AMOUNT}&wager=T`,
          },
          // {
          //   label: "Bet " + DEFAULT_BET_AMOUNT + " SOL More", // button text
          //   href: `${baseHref}&amount=${DEFAULT_BET_AMOUNT}&wager={wager}`, // this href will have a text input
          //   parameters: [
          //     {
          //       type: "radio",
          //       name: "wager", // parameter name in the `href` above
          //       label: "Bet on: ", // placeholder of the text input
          //       required: true,
          //       options: [
          //         { label: "Heads", value: "H" },
          //         { label: "Tails", value: "T" },
          //       ],
          //     },
          //   ],
          // },
        ],
      },
    };
    if (result) {
      console.log(toPubkey.toString(), " won ", amount * 2);

      const tempWallet = Keypair.fromSecretKey(
        Uint8Array.from(Buffer.from(process.env.SECRET_KEY!, 'hex'))
      );

      await sendWinnings(tempWallet, account, amount * 2);

      nextAction.icon =
        "https://cdn.pixabay.com/photo/2024/07/28/19/29/ai-generated-8928237_1280.png"; //win the bet image
      nextAction.title =
        "Congratulations! " +
        amount * 2 +
        " SOL in on the way to your account. Bet more?";
      nextAction.description =
        "Bet: " +
        (wager == "H" ? "Heads" : "Tails") +
        "\nOutcome: " +
        (wager == "H" ? "Heads" : "Tails");
    } else {
      // lost the best

      console.log(toPubkey.toString(), " lost ", amount);
      nextAction.icon =
        "https://cdn.pixabay.com/photo/2023/07/12/22/41/ai-generated-8123477_1280.png"; //lose the bet image
      nextAction.title = "Sorry, you lost your bet. Bet more?";
      nextAction.description =
        "\nBet: " +
        (wager == "H" ? "Heads" : "Tails") +
        "\nOutcome: " +
        (wager == "H" ? "Tails" : "Heads");
    }

    console.log("\n\nSending next action:");
    console.log(JSON.stringify(nextAction));

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Sent ${amount} SOL to Alice: ${toPubkey.toBase58()}`,
        links: {
          next: {
            type: "inline",
            action: nextAction,
          },
        },
      },
      // note: no additional signers are needed
      // signers: [],
    });

    return Response.json(payload, {
      headers,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers,
    });
  }
};

function validatedQueryParams(requestUrl: URL) {
  let toPubkey: PublicKey = new PublicKey(
    "2GeK9GZrUiz7JCVfQ7VrqiT8JfYGUyfXTo2DbqmkcDFF"
  );
  let amount: number = DEFAULT_BET_AMOUNT;
  let wager: string = "H";

  try {
    if (requestUrl.searchParams.get("to")) {
      toPubkey = new PublicKey(requestUrl.searchParams.get("to")!);
    }
  } catch (err) {
    throw "Invalid input query parameter: to";
  }

  try {
    if (requestUrl.searchParams.get("amount")) {
      amount = parseFloat(requestUrl.searchParams.get("amount")!);
    }

    if (amount <= 0) throw "amount is too small";
  } catch (err) {
    throw "Invalid input query parameter: amount";
  }

  try {
    if (requestUrl.searchParams.get("wager")) {
      wager = requestUrl.searchParams.get("wager") || wager;
    }
  } catch (err) {
    throw "Invalid input query parameter: wager";
  }

  return {
    amount,
    toPubkey,
    wager,
  };
}

function gamble(wager: string) {
  return Math.random() > 0.5;
}

async function sendWinnings(
  fromPubKey: Keypair,
  toPubkey: PublicKey,
  amount: number
) {
  const connection = new Connection(clusterApiUrl("devnet"));

  // get the latest blockhash amd block height
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  // try {
  //   let airdropSignature = await connection.requestAirdrop(
  //     fromPubKey.publicKey,
  //     LAMPORTS_PER_SOL * amount * 2
  //   );

  //   console.log("Airdrop successful with signature: ", airdropSignature);
  // } catch (error) {
  //   console.log("prolly rate limit err: ", error);
  // }

  const transferSolInstruction = SystemProgram.transfer({
    fromPubkey: fromPubKey.publicKey, //send transaction to toPubKey with amount
    toPubkey: toPubkey,
    lamports: amount * 2 * LAMPORTS_PER_SOL,
  });

  // create a legacy transaction
  const transaction = new Transaction({
    feePayer: fromPubKey.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(transferSolInstruction);

  var signature = await sendAndConfirmTransaction(connection, transaction, [
    fromPubKey,
  ]);

  console.log(signature);
}
