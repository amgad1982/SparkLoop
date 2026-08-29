# SparkLoop Mobile (Flutter)

Cross-platform Flutter application for **SparkLoop** supporting iOS, Android, and Web.

## Documentation & Architecture Plan

- Detailed Implementation Plan: [FLUTTER_IMPLEMENTATION_PLAN.md](./FLUTTER_IMPLEMENTATION_PLAN.md)

## Architecture Overview

- **Pattern**: Layered Clean Architecture + MVVM + Repository Pattern
- **State Management**: `provider` (`ChangeNotifier` ViewModels)
- **Routing**: `go_router` (`StatefulShellRoute` with 5-tab adaptive bottom navigation)
- **Real-Time Services**: Centrifugo WebSockets & LiveKit SFU WebRTC
- **Languages**: English & Arabic with full RTL support
