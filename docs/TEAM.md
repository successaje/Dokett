# Dokett team

Dokett is built by one founder and one core collaborator, both working on the
project full time. The team combines protocol engineering with the research,
communication and ecosystem work required to turn a registry into shared
infrastructure.

## Success Aje — founder, protocol

Success owns Dokett's technical implementation end to end: protocol design,
Solidity contracts, Universal Smart Contract integration, the unattended
keeper, Lens indexer and public API, gas-sponsored cure relay, Console and
deployment infrastructure.

His work before Dokett includes two co-founded products shipped to real users,
smart contract development across multiple ecosystems and cross-chain protocol
work.

### OmniFuse

[OmniFuse](https://omnifuse.vercel.app) is a cross-chain lending protocol on
ZetaChain. A user can supply collateral on one chain and borrow on another
through ZetaChain universal apps, with automated liquidation and configurable
per-asset risk parameters.

OmniFuse led directly to Dokett. Moving assets and enforcing a visible position
across chains did not answer what the same borrower already owed elsewhere.
Dokett addresses that missing shared-obligation layer.

- [Application source](https://github.com/successaje/OmniFuse)
- [Protocol source](https://github.com/successaje/OmniFuse-Zeta)

### GameBloc

Success co-founded [GameBloc](https://github.com/Game-Bloc/Gamebloc-ICP),
competitive gaming infrastructure on the Internet Computer. The product served
approximately 1,500 users and supported more than 100 tournaments. Its public
organization spans Internet Computer and Solana repositories.

### KawaK

Success co-founded [KawaK](https://3ysab-rqaaa-aaaan-qaewq-cai.ic0.app), a
decentralized writing platform designed to allocate rewards according to merit
rather than audience size.

### ic-puzzle and ZetaChain

At ic-puzzle, Success worked as a smart contract developer on NFT
fractionalization: representing one asset as independently held claims. The
[collection is published on Entrepot](https://entrepot.app/marketplace/puzzle).

He has also contributed pull requests across ZetaChain's documentation, node,
toolkit and example-contract repositories. The contributions are
[publicly searchable on GitHub](https://github.com/search?q=org%3Azeta-chain+author%3Asuccessaje+is%3Apr&type=pullrequests).

Success is currently expanding his work into Web3 protocol and market research.

## Emmanuel Kehinde — core collaborator, research and growth

Emmanuel is a mechanical engineering graduate and Web3 researcher. At Dokett he
supports technical and market research, translates protocol work into clear
ecosystem narratives, manages content and social channels, supports community
operations, and identifies distribution and integration opportunities.

His selected prior work includes:

- **MarsinSight** — a financial analytics MVP that converts bank-statement PDFs
  into visual spending insights using Python, FastAPI, Pandas, pdfplumber and
  Matplotlib.
- **GUIversity** — an Aptos learning platform combining personalized learning,
  gamification, community-created content and a learn-to-earn model.
- **Flint** — research, content, social media and community operations for a
  project in the Flare ecosystem.
- **PoRprotocol** — Web3 product and ecosystem work as part of the team during
  the Turing Hackathon.

Emmanuel's core strength is understanding a technical product, identifying the
part that matters to its audience, and communicating it clearly.

## Current execution: Dokett

Dokett is the team's most recent body of work and the most directly inspectable:

- five source-verified contracts deployed on Creditcoin CC3;
- 99 passing contract, projection and relay tests;
- an unattended keeper that evaluates obligations without a privileged reporter;
- a free, unauthenticated public read API;
- a gas-sponsored cure relay;
- a separate reference lender consuming only the public API; and
- `AscVerify.sol`, a standalone MIT library that adds receipt-success checks,
  confirmation depth, replay protection, runtime chain-key resolution and
  liveness guards around USC verification.

The testnet registry and its borrower identities are synthetic. The payment
evidence exercised by the protocol comes from real Ethereum mainnet
transactions.
