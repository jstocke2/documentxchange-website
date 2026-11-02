# DocumentXchange Website

This repository contains the public website source for [DocumentXchange](https://documentxchange.app/), including the marketing site, founder portfolio, public-record marketplace interface, customer account interface, checkout interface, support pages, and legal pages.

## Repository scope

This is a website-only repository. It intentionally does **not** contain:

- The DocumentXchange iOS or Android application source
- Native mobile configuration or signing information
- Backend services, database migrations, workers, or infrastructure
- Production credentials or environment files

The mobile applications and backend remain in a separate private repository.

## Technology

- React
- Vite
- JavaScript
- HTML and CSS
- PDF.js browser assets

## Local development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
```

The production-ready website is generated in `dist-website/`.

## Live website

[documentxchange.app](https://documentxchange.app/)

Copyright © DocumentXchange LLC. All rights reserved. Public visibility of this source does not grant permission to copy, redistribute, sublicense, or create derivative commercial products.
