# Retell Voice Bot

A Next.js application that implements voice chat functionality using the Retell AI SDK. This project enables real-time voice interactions with AI through an intuitive interface.

![image](https://github.com/user-attachments/assets/7d4a352b-59aa-414e-b85d-6f570ae8167c) 
![image](https://github.com/user-attachments/assets/ad67baa0-4f1a-45e1-ab80-4a2338715dae)



## Features

- Real-time voice chat with AI-powered responses
- Live speech-to-text transcription
- Persistent message history and threading
- Robust error handling and status monitoring
- Clean, responsive user interface
- WebRTC-based audio streaming

## Prerequisites

Before you begin, ensure you have:

- Node.js 18 or higher installed
- A Retell AI account with valid API credentials
- A modern web browser with microphone support
- npm or yarn package manager

## Getting Started

### Environment Setup

1. Clone the repository and navigate to the project directory
2. Create a `.env.local` file in the root directory with your credentials:

```env
NEXT_PUBLIC_RETELL_API_KEY=your_retell_api_key
NEXT_PUBLIC_RETELL_AGENT_ID=your_agent_id
```

3. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Development Server

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

## Technical Architecture

### Project Structure

```
retell-voice-bot/
├── components/         # React components
│   ├── VoiceBot.tsx   # Main voice chat interface
│   └── RetellWidget.tsx # Retell integration widget
├── hooks/             # Custom React hooks
│   ├── use-retell.ts  # Retell client hook
│   └── use-retell-web.ts # Web client implementation
├── types/             # TypeScript definitions
│   └── retell.ts      # Type definitions for Retell
├── lib/               # Utility functions
└── public/            # Static assets
```

### Core Components

#### VoiceBot Component
The main interface component that handles:
- Voice chat session management
- Real-time transcription display
- Message history rendering
- Status and error presentation

#### RetellClient Integration
Manages the WebRTC connection with features:
- Audio stream handling
- Event management
- Call lifecycle control
- Real-time transcription processing

### Technical Specifications

#### Audio Configuration
- Sample Rate: 24000Hz
- Audio Input: Browser default device
- Language Support: English (default)

#### Event System

The application implements handlers for:

| Event | Description |
|-------|-------------|
| transcription | Real-time speech-to-text updates |
| response | AI message responses |
| error | Error event handling |
| call_ended | Call termination management |

#### Error Handling

Comprehensive error management for:
- API connectivity issues
- Audio device failures
- Call initialization problems
- Runtime exceptions

Each error type includes:
- Detailed error logging
- User-friendly error messages
- Appropriate fallback behaviors
- Recovery mechanisms

## Development Guide

### Local Development

1. Ensure all prerequisites are met
2. Configure environment variables
3. Install dependencies
4. Start development server
5. Begin making changes

### Testing

Run the test suite:

```bash
npm test
# or
yarn test
```

### Building for Production

Create a production build:

```bash
npm run build
# or
yarn build
# or
pnpm build
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass
- Keep pull requests focused in scope

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Retell AI](https://retellai.com/)
- Uses [WebRTC](https://webrtc.org/) for real-time communication

## Support

For support, please:
Contact Retell AI support for API-specific questions
