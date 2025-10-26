# K Market

> A decentralized prediction market platform built on Solana blockchain, enabling users to predict and bet on future events through AI-driven content aggregation and smart contract technology.

## 🌐 Live Demo

**[🚀 Experience K Market Now](https://shelton-cometical-gladys.ngrok-free.dev/)**

*Supports Phantom, Solflare and other Solana wallet connections*

## 🏗️ Technical Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js 14 App] --> B[React Components]
        B --> C[Tailwind CSS]
        B --> D[Framer Motion]
    end
    
    subgraph "Web3 Integration Layer"
        E[Solana Wallet Adapter] --> F[Phantom/Solflare]
        E --> G[@solana/web3.js]
        G --> H[Solana RPC]
    end
    
    subgraph "Smart Contract Layer"
        I[Anchor Framework] --> J[Rust Programs]
        J --> K[Solana Devnet]
        K --> L[Program Accounts]
    end
    
    subgraph "Backend Service Layer"
        M[Netlify Functions] --> N[AI Content Crawler]
        N --> O[Market Generator]
        O --> P[Real-time Updates]
    end
    
    subgraph "Data Sources"
        Q[CoinDesk API] --> N
        R[ESPN API] --> N
        S[Reuters API] --> N
    end
    
    A --> E
    A --> M
    E --> I
    M --> I
    
    style K fill:#9945FF
    style J fill:#14F195
    style A fill:#61DAFB
```

## 👥 Team Introduction

| Role | Member | Responsibilities |
|------|--------|------------------|
| 🎯 **Project Lead** | **Eason** | Project management, product planning, technical architecture design |
| 🎨 **UI/UX Designer** | **Willam** | Interface design, user experience, visual standards |
| 💻 **Full-Stack Developer** | **Reece** | Solana smart contract development, frontend implementation, Web3 integration |

## 🌟 Core Features

- **🔗 Solana Integration**: Smart contracts built with Anchor framework, supporting multiple Solana wallets
- **🌍 Multi-language Support**: Supports Chinese, English, Japanese, and Korean
- **🤖 AI Content Aggregation**: Automatically crawls and generates prediction markets from multiple news sources
- **📱 Responsive Design**: Perfect adaptation for desktop and mobile devices
- **⚡ Real-time Data**: WebSocket real-time updates for market data and prediction results
- **☁️ Serverless Architecture**: Scalable backend based on Netlify Functions

## 🚀 Tech Stack

### Frontend Technologies
- **Next.js 14** - React full-stack framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Atomic CSS framework
- **Framer Motion** - Animation library
- **next-intl** - Internationalization solution

### Web3 Technologies
- **@solana/web3.js** - Solana JavaScript SDK
- **@solana/wallet-adapter** - Solana wallet adapter
- **Anchor Framework** - Solana smart contract development framework
- **Rust** - Smart contract programming language

### Backend Technologies
- **Netlify Functions** - Serverless functions
- **Cheerio & Puppeteer** - Web crawling and data scraping
- **AI Content Processing** - Intelligent market generation algorithms

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- Solana CLI (optional, for local development)

### Installation Steps

1. **Clone the project**
   ```bash
   git clone <repository-url>
   cd Predix
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure in `.env.local`:
   ```env
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open your browser and visit [http://localhost:3000](http://localhost:3000)

## 📈 Roadmap (Next Month)

### Week 1 - Core Feature Optimization
- [ ] Improve smart contract side pool allocation logic
- [ ] Optimize frontend wallet connection experience
- [ ] Add more prediction market categories

### Week 2 - User Experience Enhancement
- [ ] Implement user profiles and history records
- [ ] Add market search and filtering functionality
- [ ] Optimize mobile interaction experience

### Week 3 - Feature Expansion
- [ ] Integrate more data sources (Twitter API, Reddit API)
- [ ] Implement community voting and discussion features
- [ ] Add market creator incentive mechanisms

### Week 4 - Performance & Security
- [ ] Smart contract security audit
- [ ] Frontend performance optimization and SEO
- [ ] Deploy to Solana Mainnet
- [ ] User feedback collection and iteration

## 🚀 Deployment

### Netlify Deployment

1. Connect GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `out`
4. Configure environment variables
5. Automatic deployment to production environment

---

**Built with ❤️ by the K Market team**