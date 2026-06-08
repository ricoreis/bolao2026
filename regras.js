// regras.js - Lógica pura de cálculo via banco
function calcularPontos(palpA, palpB, realA, realB, tabelaRegras, multiplicador = 1) {
    const pA = parseInt(palpA), pB = parseInt(palpB), rA = parseInt(realA), rB = parseInt(realB);
    const get = (sigla) => tabelaRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0;

    let pts = 0;
    if (pA === rA && pB === rB) pts = get('EXATO');
    else if (pA === pB && rA === rB) pts = get('EMPATE');
    else if ((pA - pB) === (rA - rB)) pts = get('SALDO');
    else if ((pA > pB && rA > rB) || (pA < pB && rA < rB)) pts = get('VENC');
    else if ((pA === rB && pB === rA)) pts = get('-EXATO');
    else if ((pB - pA) === (rA - rB)) pts = get('-SALDO');
    else if ((pA > pB && rA < rB) || (pA < pB && rA > rB)) pts = get('-VENC');

    const bonus = (Math.min(pA, rA) + Math.min(pB, rB)) * get('GOLS');
    
    // Aplica o multiplicador da fase (ex: 2 para mata-mata, 1 para grupos)
    return (pts + bonus) * multiplicador;
}