// example.cjs
const {
    PaketDelilSorgula,
    PaketSorgula,
} = require("./kepClient.js"); // CJS sürümünü içe aktar

const { delilIndir } = require("./downloadDelil.js")
const fs = require("fs");

const DelilTurDescription = {
    10: "S/MIME paketi Kephs tarafından kabul edildi",
    11: "S/MIME paketi Kephs tarafından reddedildi",

    20: "S/MIME paketi diğer Kephs tarafından kabul edildi",
    21: "S/MIME paketi diğer Kephs tarafından reddedildi",

    31: "S/MIME paketi diğer Kephs’ye gönderilemedi",

    40: "S/MIME paketi alıcı kullanıcının mesaj kutusuna bırakıldı",
    41: "S/MIME paketi alıcı kullanıcının mesaj kutusuna bırakılamadı",

    60: "S/MIME paketi alıcı kullanıcı tarafından okundu"
};

async function main() {
    const paketSorgula = await PaketSorgula({
        //kepHesap zorunlu değil, client'tan alınır
        ilktarih: "2025-01-01T00:00:00",
        sontarih: "2025-12-31T23:59:59",
        dizin: "INBOX.Sent",

    });

    const index = paketSorgula.return.kepId.indexOf("<EYWS5c564d8d-216b-4e96-92cd-ac0e8e8548df.05112025183748.pttkepMimeyap>");

    const paketDelilSorgula = await PaketDelilSorgula({
        //kepHesap zorunlu değil, client'tan alınır
        kepId: paketSorgula.return.kepId[index],
        kepSiraNo: paketSorgula.return.kepSiraNo[index],
        dizin: "INBOX.Sent",
    });

    const deliller = [];

    paketDelilSorgula.return.delilId.forEach((element, index) => {
        deliller.push({
            delilId: element,
            delilaciklama: paketDelilSorgula.return.delilaciklama[index],
            delilTurId: paketDelilSorgula.return.delilTurId[index],
            tarih: paketDelilSorgula.return.tarih[index],
            kephs: paketDelilSorgula.return.kephs[index],
            delilaciklama: DelilTurDescription[paketDelilSorgula.return.delilTurId[index]] || "Bilinmeyen delil türü"
        });
    });

    console.log("deliller : ", deliller);

    try {
        // burada delili axiosla çağırıyoruz çünkü soap kütüphanesi multipartı düzgün işleyemiyor
        const delilData = await delilIndir({
            delilId: deliller[0].delilId
        });

        if (delilData) {
            // Dosya tipine göre uzantı belirle
            const isXml = delilData.toString('utf8', 0, 100).includes('<?xml');
            const filename = isXml ? 'edelil.xml' : 'edelil.zip';

            fs.writeFileSync(filename, delilData);
            console.log(`✓ Dosya kaydedildi: ${filename} (${delilData.length} bytes)`);
        }
    } catch (error) {
        console.error("Hata:", error.message);
    }

}

main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
});
