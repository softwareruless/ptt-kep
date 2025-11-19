// example.cjs
const {
  MimeYap,
  SmimeGonder,
} = require("./kepClient.js"); // CJS sürümünü içe aktar

const fs = require("fs");
const path = require("path");
const os = require("os");

const platform = os.platform();

const chilkat =
  platform === "darwin"
    ? require("@chilkat/ck-node22-mac-universal")
    : platform === "linux"
    ? require("@chilkat/ck-node22-linux-x64")
    : platform === "win32" && require("@chilkat/ck-node22-win64");

// Kaynak klasörü
const resources = path.join(__dirname, "resources");

/** AKİS (TÜBİTAK) PKCS#11 kütüphanesini yükleyici */
function loadAkisLib(signType, pkcs11) {
  if (signType === "akis") {
    if (os.platform() === "win32") {
      console.log("AKiS & Windows");
      pkcs11.SharedLibPath = path.join(resources, "akisp11.dll");
    } else if (os.platform() === "linux") {
      console.log("AKiS & Linux");
      pkcs11.SharedLibPath = path.join(resources, "libakisp11.so");
    } else if (os.platform() === "darwin") {
      console.log("AKiS & macOS");
      pkcs11.SharedLibPath = path.join(resources, "libakisp11.dylib");
    }
  } else if (signType === "aladdin") {
    throw new Error("Aladdin şu anda desteklenmiyor.");
  } else {
    throw new Error("Bu imza tipi şu anda desteklenmiyor.");
  }
}

/**
 * hashToSign: Base64 SHA-256 özeti
 * opts: { signType: "akis", slotID?: number, pin: string|number, expectedTckn?: string }
 * DÖNÜŞ: Base64 imza
 */
async function signFunc(hashToSign, opts = {}) {
  const { signType = "akis", pin } = opts;

  if (!hashToSign) throw new Error("signFunc: hashToSign (Base64) zorunlu.");
  if (pin === undefined || pin === null || `${pin}`.length === 0) {
    throw new Error("signFunc: PIN zorunlu.");
  }

  const pkcs11 = new chilkat.Pkcs11();
  loadAkisLib(signType, pkcs11);

  let success = pkcs11.Initialize();
  if (success === false) {
    const err = pkcs11.LastErrorText;
    console.error("PKCS#11 Initialize:", err);
    throw new Error("Belgeniz imzalanırken bir sorun oluştu: " + err);
  }

  success = pkcs11.OpenSession(-1, true); // true = serial session
  if (success === false) {
    const err = pkcs11.LastErrorText || "";
    console.error("OpenSession:", err);
    if (err.includes("CKR_TOKEN_NOT_PRESENT")) {
      throw new Error("Cihaz üzerinde kart/token takılı değil.");
    }
    throw new Error("Cihazınızın takılı olduğundan emin olun. Ayrıntı: " + err);
  }

  // 1 = CKU_USER
  success = pkcs11.Login(1, pin);
  if (success === false) {
    const err = pkcs11.LastErrorText || "";
    console.error("Login Error:", err);
    pkcs11.CloseSession();
    if (err.includes("CKR_PIN_INCORRECT")) {
      throw new Error("PIN hatalı.");
    } else if (err.includes("This PIN already failed for this ATR.")) {
      throw new Error("Aynı hatalı PIN tekrar denendi.");
    } else if (err.includes("CKR_PIN_LOCKED")) {
      throw new Error("E-imza bloke oldu.");
    }
    throw new Error("Belge imzalama sırasında hata (Login): " + err);
  }

  // Özel anahtarı olan sertifikayı bul
  const cert = new chilkat.Cert();
  success = pkcs11.FindCert("privateKey", "", cert);
  if (success === false) {
    console.log("Unlock failed:", cert.LastErrorText);
    pkcs11.CloseSession();
  }

  const crypt = new chilkat.Crypt2();
  crypt.SetSigningCert(cert);

  const p7s_b64 = crypt.SignHashENC(hashToSign, "sha256", "base64");

  pkcs11.Logout();
  pkcs11.CloseSession();

  return p7s_b64;
}

async function unlockChilkat() {
  const glob = new chilkat.Global();
  const successUnlock = glob.UnlockBundle(process.env.CHILKAT_KEY);
  if (!successUnlock) {
    console.log("Unlock failed:", glob.LastErrorText);
    res.status(500).json({});

    throw new Error("Unlock hatası. Belgeniz imzalanırken bir sorun oluştu")
  }
}

async function main() {

  // --- MIME oluştur ---
  const pdfBuffer = fs.readFileSync("./sample.pdf");
  const base64Binary = pdfBuffer.toString("base64");

  const mimeYap = await MimeYap({
    //kepHesap zorunlu değil, client'tan alınır
    ePaketTur: "Standart",
    ePaketId: "1234678901231231",
    kime: process.env.ILETILEN_KEP_HESAP,
    konu: "Deneme Konu",
    icerik: "Merhaba, bu bir deneme e-İçerik mesajıdır.",
    eIcerikTur: "TEXT",
    ekler: [{
      attributes: {
        contentType: 'application/pdf',
        fileName: 'ornek.pdf'
      },
      $value: base64Binary  // XML text node için $value kullanılır
    }],
  });

  console.log("MimeYap:", mimeYap);

  //chilkat 30 gün boyunca ücretsizdir, 30 gun sonunda otomatik olarak kilitlenir üyelik alarak kullanmaya devam edebilirsiniz
  await unlockChilkat();

  // --- Hash'i imzala (Base64 SHA-256) ---
  const signed = await signFunc(mimeYap.return.eHash, {
    signType: process.env.SIGN_TYPE,
    pin: process.env.SMART_CARD_PIN,
  });

  // --- S/MIME gönder ---
  const smimeGonder = await SmimeGonder({
    //kepHesap zorunlu değil, client'tan alınır
    mesajid: mimeYap.return.mesajid,
    imza: signed,
  });

  console.log("SmimeGonder:", smimeGonder);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
