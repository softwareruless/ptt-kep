# wsdlKep

Lightweight Node.js utilities for interacting with the Turkish KEP e-Yazışma SOAP API.

This repository contains small example scripts and a client wrapper for calling KEP (Kamu Elektronik Posta) WSDL endpoints, signing S/MIME packages using a smart card (AKİS), and downloading "delil" (evidence) packages.

## At a glance
- Language: Node.js (CommonJS)
- Purpose: build and sign S/MIME MIME packets and call KEP SOAP endpoints
- Key files:
	- `index.js` — example flow: create MIME, unlock chilkat, sign with smart card and send S/MIME
	- `kepClient.js` — core SOAP client helper and operations
	- `delilSorgula.js` — example script for querying and downloading delil (evidence)
	- `delilIndir.js` — helper to download delil via SOAP/axios
	- `.env` — environment variables (secrets) used by the app (excluded from git)

## Requirements
- Node 22+ (or a compatible LTS)
- npm
- If you sign locally with Chilkat/AKİS, optional Chilkat native packages are declared in `optionalDependencies` (mac/win). Those are only required if you use `index.js` unlocking/signing features.

## Install

Clone and install dependencies:

```bash
git clone <repo-url>
cd wsdlKep
npm install
```

If you plan to use smart-card signing and Chilkat APIs, install the matching optional native package for your OS (Mac/Windows). On mac:

```bash
npm i @chilkat/ck-node22-mac-universal
```

## Environment variables
Create a `.env` file or in the project root. Example `.env` values used by the project:

```env
WSDL_URL=https://eyazisma.hs01.kep.tr/KepEYazismaV1.1/KepEYazismaCOREWSDL.php?wsdl
ENDPOINT_OVERRIDE_URL=https://eyazisma.hs01.kep.tr/KepEYazismaV1.1/KepEYazismaCOREWSDL.php

SMART_CARD_PIN=1234
SIGN_TYPE=akis

KEP_HESAP=your@kep.account
KEP_TCNO=00000000000
KEP_PAROLA=your_password
KEP_SIFRE=your_key_or_pass

