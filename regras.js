function calcularPontos(palpA, palpB, realA, realB, tabelaRegras, penaltisPalp, penaltisReal, multiplicador = 1) {
    const pA = parseInt(palpA), pB = parseInt(palpB), rA = parseInt(realA), rB = parseInt(realB);
    const pPen = parseInt(penaltisPalp);
    const rPen = parseInt(penaltisReal);
    const get = (sigla) => parseInt(tabelaRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0);

    let pts = 0;
    let penal = 0;
    let coluna = null;
    
    // Flags de controle
    let ehExato = false;
    let ehSaldo = false;
    let ehVenc = false;
    let ehEmpate = false;

    if (pA === rA && pB === rB) { pts = get('EXATO'); coluna = 'placar_exato'; ehExato = true; }
    else if (pA === pB && rA === rB) { pts = get('EMPATE'); coluna = 'placar_empate'; }
    else if ((pA - pB) === (rA - rB)) { pts = get('SALDO'); coluna = 'placar_saldo'; ehSaldo = true; }
    else if ((pA > pB && rA > rB) || (pA < pB && rA < rB)) { pts = get('VENC'); coluna = 'placar_vencedor'; ehVenc = true; }
    else if (pA === pB && rA === rB) { pts = get('EMPATE'); coluna = 'placar_empate'; ehEmpate = true; }    
    else if ((pA === rB && pB === rA)) { pts = get('-EXATO'); coluna = 'placar_exato_contrario'; }
    else if ((pB - pA) === (rA - rB)) { pts = get('-SALDO'); coluna = 'placar_saldo_contrario'; ehSaldo = false; }
    else if ((pA > pB && rA < rB) || (pA < pB && rA > rB)) { pts = get('-VENC'); coluna = 'placar_vencedor_contrario'; ehVenc = false; }

    if (rPen && pPen === rPen) { 
        penal = get('PENAL'); 
        coluna = 'placar_classificado_penaltis'; 
    }

    const bonus = (Math.min(pA, rA) + Math.min(pB, rB)) * get('GOLS');
    const total = ((pts + bonus) * multiplicador) + penal;

    return {
        total: total,
        coluna: coluna,
        bonus: bonus,
        exato: ehExato,
        saldo: ehSaldo,
        venc: ehVenc,
        empate: ehEmpate
    };
}