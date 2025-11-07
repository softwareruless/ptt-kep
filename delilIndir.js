const axios = require("axios");

const endpointOverride = process.env.ENDPOINT_OVERRIDE_URL || "https://eyazisma.hs01.kep.tr/KepEYazismaV1.1/KepEYazismaCOREWSDL.php";

async function delilIndir(params) {
    const requestXml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xmlns:ns1="http://ws.apache.org/axis2/xsd" xmlns:ns0="http://ws.apache.org/axis2"><soap:Body><ns0:PaketDelilIndir xmlns:ns0="http://ws.apache.org/axis2" xmlns="http://ws.apache.org/axis2"><ns0:param0><ns1:kepHesap xmlns:ns1="http://ws.apache.org/axis2/xsd"><ns1:kepHesap>${process.env.KEP_HESAP}</ns1:kepHesap><ns1:tcno>${process.env.KEP_TCNO}</ns1:tcno><ns1:parola>${process.env.KEP_PAROLA}</ns1:parola><ns1:sifre>${process.env.KEP_SIFRE}</ns1:sifre></ns1:kepHesap><ns1:delilId xmlns:ns1="http://ws.apache.org/axis2/xsd">${params.delilId}</ns1:delilId></ns0:param0></ns0:PaketDelilIndir></soap:Body></soap:Envelope>`
    // Manuel axios request
    const response = await axios.post(endpointOverride, requestXml, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': ''
        },
        responseType: 'arraybuffer'
    });

    const bodyBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'];

    console.log("Content-Type:", contentType);

    if (contentType && contentType.includes('multipart')) {
        const boundaryMatch = contentType.match(/boundary[=:]"?([^";\s]+)"?/i);
        if (!boundaryMatch) {
            throw new Error("Boundary bulunamadı!");
        }

        const boundary = boundaryMatch[1];
        console.log("Boundary:", boundary);

        // Binary olarak split et
        const parts = bodyBuffer.toString('binary').split(`--${boundary}`);
        console.log(`Toplam ${parts.length} part bulundu`);

        // İlk part SOAP response - CID'yi buradan al
        let targetCid = null;
        for (const part of parts) {
            if (part.includes('xop:Include') && part.includes('href=')) {
                const cidMatch = part.match(/href="cid:([^"]+)"/);
                if (cidMatch) {
                    targetCid = cidMatch[1];
                    console.log("Hedef CID bulundu:", targetCid);
                    break;
                }
            }
        }

        if (!targetCid) {
            console.log("CID bulunamadı, ilk binary part'ı döndürüyorum");
        }

        // CID'ye göre veya ilk binary part'ı bul
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // Content-ID header'ı var mı?
            const cidHeaderMatch = part.match(/content-id:\s*<?([^>\r\n]+)>?/i);

            if (cidHeaderMatch) {
                const partCid = cidHeaderMatch[1];
                console.log(`Part ${i}: CID = ${partCid}`);

                // Hedef CID ile eşleşiyor mu veya hedef yoksa ilk binary part mı?
                if (!targetCid || partCid === targetCid) {
                    // Binary data başlangıcını bul (çift newline)
                    const headerEnd = part.indexOf('\r\n\r\n');
                    if (headerEnd === -1) {
                        console.log("Header sonu bulunamadı, atlanıyor");
                        continue;
                    }

                    // Binary data'yı çıkar
                    const binaryPart = part.slice(headerEnd + 4);
                    const binaryData = Buffer.from(binaryPart, 'binary');

                    console.log(`✓ Binary data bulundu: ${binaryData.length} bytes`);

                    // İlk 200 byte'ı kontrol et
                    const preview = binaryData.toString('utf8', 0, Math.min(200, binaryData.length));
                    console.log("Önizleme:", preview);

                    return binaryData;
                }
            }
        }

        throw new Error("Binary data bulunamadı!");
    }

    throw new Error("Multipart response değil!");
}

module.exports = {
    delilIndir
};