# **App Name**: Brimo UI Enhancer

## Core Features:

- UI Rendering: Render the Brimo UI with main functionality
- Real-time balance updates: Implement Firestore to keep track of account balances to be kept updated in real-time. Balances are automatically synchronized, for all 'Kas Terintegrasi' accounts such as Tunai, Bank, PPOB, E-Wallet, and Merchant.
- Transaction summarization: Use a Large Language Model to summarize recent transactions, including categorizing transactions and identifying unusual spending patterns; act as a tool to help users understand their spending habits
- Settings Persistence: Persist the user's 'showBalance' and 'activeTab' preference in Firebase
- Firebase Integration: Set up backend data connection using Firestore

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to evoke trust and security, reflecting financial stability.
- Background color: Light blue (#E8EAF6), creating a calm and clean user interface.
- Accent color: Purple (#7E57C2), adding sophistication and highlighting important interactions.
- Body and headline font: 'Inter', a grotesque-style sans-serif for a modern and neutral look. Note: currently only Google Fonts are supported.
- Use consistent and modern icons from Lucide React library for clear visual representation.
- Maintain a clean, card-based layout for easy navigation and readability, focusing on key financial data.
- Incorporate subtle transition animations to enhance user experience, providing visual feedback on interactions.