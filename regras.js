function calcularPontos(palpA, palpB, realA, realB) {
    const pA = parseInt(palpA), pB = parseInt(palpB), rA = parseInt(realA), rB = parseInt(realB);
    
    // 1. Definição das Regras conforme sua tabela (image_394215.png)
    let pts = 0;

    // Cenários Positivos
    if (pA === rA && pB === rB) pts = 7; // Placar Exato
    else if (pA === pB && rA === rB) pts = 5; // Empate
    else if ((pA - pB) === (rA - rB)) pts = 5; // Placar Saldo
    else if ((pA > pB && rA > rB) || (pA < pB && rA < rB)) pts = 3; // Time Vencedor
    
    // Cenários Negativos (Contrários)
    else if ((pA === rB && pB === rA)) pts = -7; // Exato Contrário
    else if ((pB - pA) === (rA - rB)) pts = -5;  // Saldo Contrário
    else if ((pA > pB && rA < rB) || (pA < pB && rA > rB)) pts = -3; // Vencedor Contrário

    // 2. Bônus por Gol (Sempre positivo conforme sua tabela)
    const bonus = Math.min(pA, rA) + Math.min(pB, rB);
    
    return pts + bonus;
}