const texto = (valor: string) => valor.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
// RFC 5545: folding counts UTF-8 octets, never UTF-16 code units.
function dobrar(linha: string) {
  const linhas: string[] = []; let atual = "";
  for (const caractere of linha) {
    if (Buffer.byteLength(atual + caractere, "utf8") > 75) { linhas.push(atual); atual = " "; }
    atual += caractere;
  }
  return [...linhas, atual].join("\r\n");
}
export function gerarAgenda(evento: { id: string; titulo: string; data: string; inicio: string; fim: string; local: string; revisao: number }, agora = new Date()) {
  const dia = evento.data.replaceAll("-", "");
  const hora = (v: string) => v.slice(0, 5).replace(":", "") + "00";
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pieggi//Eventos//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:America/Sao_Paulo", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "TZNAME:-03", "END:STANDARD", "END:VTIMEZONE",
    "BEGIN:VEVENT", `UID:${evento.id}@pieggi`, `SEQUENCE:${evento.revisao}`, `DTSTAMP:${agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART;TZID=America/Sao_Paulo:${dia}T${hora(evento.inicio)}`, `DTEND;TZID=America/Sao_Paulo:${dia}T${hora(evento.fim)}`,
    `SUMMARY:${texto(evento.titulo)}`, `LOCATION:${texto(evento.local)}`, "DESCRIPTION:Confira a versão atual da programação no sistema Pieggi antes da saída.",
    "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR", ""].map(dobrar).join("\r\n");
}
