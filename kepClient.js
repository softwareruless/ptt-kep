// kepClient.cjs
const { createClientAsync } = require("soap");
require("dotenv").config();
// === AYARLAR ===
// WSDL: Servis tanımı
// endpointOverride: Prod/uat farklıysa gerçek endpoint
// forceSoap12Headers: Gerekirse SOAP 1.2 header gönder
// wsdlOptions: mTLS/proxy gibi alt seviye ayarlar
const WSDL = process.env.WSDL_URL || "https://eyazisma.hs01.kep.tr/KepEYazismaV1.1/KepEYazismaCOREWSDL.php?wsdl";
const endpointOverride = process.env.ENDPOINT_OVERRIDE_URL || "https://eyazisma.hs01.kep.tr/KepEYazismaV1.1/KepEYazismaCOREWSDL.php";
const forceSoap12Headers = false;

const wsdlOptions = {};

// Geçici testte self-signed izin vermek istersen (PROD’DA KULLANMA):
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/** Tek client (singleton) */
let _client;
async function getClient() {
  if (_client) return _client;
  _client = await createClientAsync(WSDL, {
    wsdl_options: wsdlOptions,
    forceSoap12Headers,
  });
  if (_client.setEndpoint && endpointOverride) {
    _client.setEndpoint(endpointOverride);
  }

  _client._mtomAttachments = {};

  _client.on('response', function (body, response, eid) {
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('multipart/related')) {
      const boundaryMatch = contentType.match(/boundary[=:]"?([^";\s]+)"?/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

        // Parse MIME parts
        const parts = bodyBuffer.toString('binary').split(`--${boundary}`);

        for (const part of parts) {
          const cidMatch = part.match(/content-id:\s*<?([^>\r\n]+)>?/i);
          if (cidMatch) {
            const cid = cidMatch[1];
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd > 0) {
              const binaryData = Buffer.from(part.slice(headerEnd + 4), 'binary');
              // Attachmentları sakla
              _client._mtomAttachments[cid] = binaryData;
            }
          }
        }
      }
    }
  });
  return _client;
}

/** Genel çağrı yardımcıları */
async function callOp(opName, param0) {
  const client = await getClient();
  const fn = client[`${opName}Async`];
  if (typeof fn !== "function") {
    throw new Error(`WSDL'de '${opName}' operasyonu bulunamadı.`);
  }

  // console.log("describes", JSON.stringify(client.describe().eyServis.eyServisSOAPport_http.KontorSorgula, null, 2));

  const input = client.describe().eyServis.eyServisSOAPport_http[opName]?.input;

  if (input?.param0?.kepHesap?.kepHesap && !param0.kepHesap?.kepHesap) {
    const kepHesap = {
      kepHesap: process.env.KEP_HESAP,
      tcno: process.env.KEP_TCNO,
      parola: process.env.KEP_PAROLA,
      sifre: process.env.KEP_SIFRE,
    }
    param0 = { kepHesap, ...param0 };

  } else if (input?.param0?.kepHesap && input?.param0?.tcno && !param0?.kepHesap?.tcno) {
    param0 = {
      kepHesap: process.env.KEP_HESAP,
      tcno: process.env.KEP_TCNO,
      parola: process.env.KEP_PAROLA,
      sifre: process.env.KEP_SIFRE,
      ...param0
    };
  }

  // tüm operasyonlar document/literal ve root'ta "param0" bekliyor
  const [res, _rawResponse, _soapHeader, _rawRequest] = await fn({ param0 });

  return res;
}

/** Aşağıdaki fonksiyonlar WSDL operasyonlarının birebir sarmalayıcılarıdır.
 * Her biri 'param0' alır. WSDL’deki tipler:
 * - eyKepHesapGirisP: { kepHesap?, tcno?, parola?, sifre? }
 * - eyGiris: { kepHesap: eyKepHesapGirisP, girisTur: "BASE"|"OTP"|"EIMZA" }
 * - eyGuvenliGiris: { kepHesap, girisTur, smsKey?, eCadesBes?, eGuvenlikId? }
 * - eyYukle: { kepHesap, ePaket(base64), ePaketTur: "Standart"|"ETEbligat"|"EYazisma" }
 * - eyYukleTebligat: { kepHesap, ePaket(base64), BirimId?, BirimAdi?, Barkod?, Donuslu? }
 * - eyIndir: { kepHesap, kepId?, kepSiraNo?, ePart?:"ALL"|"ORGM"|"ORGMATTACH", eGuvenlikId?, dizin?="INBOX" }
 * - eyPaketKepId: { kepHesap, kepId, kepSiraNo?, dizin?="INBOX" }
 * - eyPaketDelilId: { kepHesap, delilId }
 * - eyPaketSorgula: { kepHesap, ilktarih?, sontarih?, dizin?="INBOX" }
 * - eyYetkiliKayit / eyYetkiliSil, eyMimeYap, eySmimeGonder, Rehber tipleri vb. WSDL’de tarifli.
 */

/** Kimlik/Giriş */
async function Giris(param0 /* eyGiris */) {
  return callOp("Giris", param0);
}
async function GuvenliGiris(param0 /* eyGuvenliGiris */) {
  return callOp("GuvenliGiris", param0);
}

/** Paket yükleme / tebligat */
async function Yukle(param0 /* eyYukle */) {
  return callOp("Yukle", param0);
}
async function YukleTebligat(param0 /* eyYukleTebligat */) {
  return callOp("YukleTebligat", param0);
}

/** Tevdi listesi */
async function TevdiListesiOlustur(param0 /* eyTevdiListesi */) {
  return callOp("TevdiListesiOlustur", param0);
}
async function TevdiListesiSil(param0 /* eyTevdiListesiSil */) {
  return callOp("TevdiListesiSil", param0);
}

/** Kontör / kota / istatistik / dizin */
async function KontorSorgula(param0 /* eyKepHesapGirisP */) {
  return callOp("KontorSorgula", param0);
}
async function TumKontorSorgula(param0 /* eyKepHesapGirisP */) {
  return callOp("TumKontorSorgula", param0);
}
async function KotaSorgula(param0 /* eyKepHesapGirisP */) {
  return callOp("KotaSorgula", param0);
}
async function IstatistikSorgula(param0 /* eyKepHesapGirisP */) {
  return callOp("IstatistikSorgula", param0);
}
async function DizinSorgula(param0 /* eyKepHesapGirisP */) {
  return callOp("DizinSorgula", param0);
}

/** Paket delil işlemleri */
async function PaketDetayDelilSorgula(param0 /* eyPaketKepId */) {
  return callOp("PaketDetayDelilSorgula", param0);
}
async function PaketDelilSorgula(param0 /* eyPaketKepId */) {
  return callOp("PaketDelilSorgula", param0);
}
async function PaketDelilIndir(param0 /* eyPaketDelilId */) {
  return callOp("PaketDelilIndir", param0);
}

/** Paket sorgulama varyantları */
async function PaketSorgula(param0 /* eyPaketSorgula */) {
  return callOp("PaketSorgula", param0);
}
async function PaketSorgula2(param0 /* eyPaketSorgula */) {
  return callOp("PaketSorgula2", param0);
}
async function PaketSorgula3(param0 /* eyPaketSorgula */) {
  return callOp("PaketSorgula3", param0);
}

/** İndirme / onay / silme */
async function Indir(param0 /* eyIndir */) {
  return callOp("Indir", param0);
}
async function AlindiOnay(param0 /* eyPaketKepId */) {
  return callOp("AlindiOnay", param0);
}
async function PaketSil(param0 /* eyPaketKepId */) {
  return callOp("PaketSil", param0);
}

/** Yetkili işlemleri */
async function YetkiliKayit(param0 /* eyYetkiliKayit */) {
  return callOp("YetkiliKayit", param0);
}
async function YetkiliSil(param0 /* eyYetkiliSil */) {
  return callOp("YetkiliSil", param0);
}

/** MIME / S-MIME */
async function MimeYap(param0 /* eyMimeYap */) {
  return callOp("MimeYap", param0);
}
async function SmimeGonder(param0 /* eySmimeGonder */) {
  return callOp("SmimeGonder", param0);
}

/** Rehber */
async function RehberGercekKisiSorgula(param0 /* eyRehberGercek */) {
  return callOp("RehberGercekKisiSorgula", param0);
}
async function RehberTuzelKisiSorgula(param0 /* eyRehberTuzel */) {
  return callOp("RehberTuzelKisiSorgula", param0);
}
async function RehberTopluKontrol(param0 /* eyRehberToplu */) {
  return callOp("RehberTopluKontrol", param0);
}

/** İsteğe bağlı: raw SOAP paketlerini görmek istersen debug yardımcıları */
async function debugLastRaw() {
  const client = await getClient();

  return {
    lastRequest: client?.lastRequest, // son gönderilen SOAP XML
    // raw response almak için çağrıdan dönen 2. parametreye bakabilirsin, burada saklamıyoruz
    endpoint: client?.getEndpoint?.(),
  };
}

module.exports = {
  getClient,
  callOp,
  // Kimlik/Giriş
  Giris,
  GuvenliGiris,
  // Paket yükleme / tebligat
  Yukle,
  YukleTebligat,
  // Tevdi
  TevdiListesiOlustur,
  TevdiListesiSil,
  // Kontör / kota / istatistik / dizin
  KontorSorgula,
  TumKontorSorgula,
  KotaSorgula,
  IstatistikSorgula,
  DizinSorgula,
  // Delil
  PaketDetayDelilSorgula,
  PaketDelilSorgula,
  PaketDelilIndir,
  // Sorgulama
  PaketSorgula,
  PaketSorgula2,
  PaketSorgula3,
  // İndirme / onay / silme
  Indir,
  AlindiOnay,
  PaketSil,
  // Yetkili
  YetkiliKayit,
  YetkiliSil,
  // MIME / S-MIME
  MimeYap,
  SmimeGonder,
  // Rehber
  RehberGercekKisiSorgula,
  RehberTuzelKisiSorgula,
  RehberTopluKontrol,
  // Debug
  debugLastRaw,
};
