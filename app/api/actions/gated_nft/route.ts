import { blurImage } from "@/utils/blur";
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


export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { toPubkey } = validatedQueryParams(requestUrl);

    const baseHref = new URL(
      `/api/actions/gated_nft?to=${toPubkey.toBase58()}`,
      requestUrl.origin
    ).toString();

    const payload: ActionGetResponse = {
      type: "action",
      title: "Make your gated content",
      icon: "",
      description: "Make and share your Gated content",
      label: "Transfer", // this value will be ignored since `links.actions` exists
      links: {
        actions: [
          {
            label: "Input amount and wager",
            href: `${baseHref}&amount={amount}&caption={caption}&image={image}`,
            parameters: [
              {
                name: "amount",
                type: "number",
                label: "10 SOL",
              },
              {
                name: "firstCaption",
                type: "text",
                label: "I found the next WIF",
              },
              {
                name: "secondCaption",
                type: "text",
                label: "next WIF is REKT ",
              },
              {
                name: "image",
                type: "url",
                label: "Image URL"
              }
            ],
          },
        ],
      },
    }
    console.log("GET response payload:", payload);
    return Response.json(payload, {
      headers,
    });
  }

  catch (error) {
    console.error("Error processing GET request:", error);
    return new Response("error occoured", {
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
    const { toPubkey, amount, firstCaption, secondCaption, image } = validatedQueryParams(requestUrl);

    const body: ActionPostRequest = await req.json();

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

    const baseHref = new URL(
      `/api/actions?to=${toPubkey.toBase58()}`,
      requestUrl.origin
    ).toString();


    const responsePayload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: "",
        links: {
          next: {
            type: "inline",
            action:
            {
              type: "action",
              icon: await blurImage(image),
              label: "bet-result",
              title: "Share blink",
              disabled: false,
              description: "Bet more?",
              links: {
                actions: [
                  {
                    label: "Share blink",
                    href: `${baseHref}&amount={amount}&caption={caption}&image={image}`,
                  },
                  
                ],
              },
            }
          }
        }
      }
    })




    return Response.json(responsePayload, {
      headers,
    });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return new Response("An unknown error occoured", {
      status: 400,
      headers,
    });
  }
};


function validatedQueryParams(requestUrl: URL) {
  let toPubkey: PublicKey = new PublicKey(
    "2GeK9GZrUiz7JCVfQ7VrqiT8JfYGUyfXTo2DbqmkcDFF"
  );
  let amount: number
  let firstCaption, secondCaption: string
  let image: string

  try {
    if (requestUrl.searchParams.get("to")) {
      toPubkey = new PublicKey(requestUrl.searchParams.get("to")!);
    }
    // New parameters
    amount = requestUrl.searchParams.get("amount") ? parseFloat(requestUrl.searchParams.get("amount")!) : 0;
    firstCaption = requestUrl.searchParams.get("firstCaption") || "";
    secondCaption = requestUrl.searchParams.get("secondCaption") || "";
    image = requestUrl.searchParams.get("image") || "";
  } catch (err) {
    throw "Invalid input query parameter: to";
  }

  return {
    toPubkey,
    amount, // Added amount
    firstCaption, secondCaption,
    image, // Added image
  };
}

