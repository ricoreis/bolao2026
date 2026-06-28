function calcularPontos(palpA, palpB, realA, realB, tabelaRegras, penaltisPalp, penaltisReal, multiplicador = 1) {
    const pA = parseInt(palpA), pB = parseInt(palpB), rA = parseInt(realA), rB = parseInt(realB);
    const pPen = parseInt(penaltisPalp);
    const rPen = parseInt(penaltisReal);
    const get = (sigla) => parseInt(tabelaRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0);

    let pts = 0;
    let penal = 0;
    let coluna = null;
    
    // Flags de controle (Positivas e Negativas)
    let ehExato = false, ehSaldo = false, ehVenc = false, ehEmpate = false;
    let ehExatoNeg = false, ehSaldoNeg = false, ehVencNeg = false;

    // --- ACERTOS POSITIVOS ---
    if (pA === rA && pB === rB) { pts = get('EXATO'); coluna = 'placar_exato'; ehExato = true; }
    else if (pA === pB && rA === rB) { pts = get('EMPATE'); coluna = 'placar_empate'; ehEmpate = true; }
    else if ((pA - pB) === (rA - rB)) { pts = get('SALDO'); coluna = 'placar_saldo'; ehSaldo = true; }
    else if ((pA > pB && rA > rB) || (pA < pB && rA < rB)) { pts = get('VENC'); coluna = 'placar_vencedor'; ehVenc = true; }
    
    // --- ACERTOS NEGATIVOS / INVERTIDOS ---
    else if (pA === rB && pB === rA && pA !== pB) { 
        pts = get('-EXATO'); coluna = 'placar_exato_contrario'; ehExatoNeg = true; 
    }
    else if ((pB - pA) === (rA - rB)) { 
        pts = get('-SALDO'); coluna = 'placar_saldo_contrario'; ehSaldoNeg = true; 
    }
    else if ((pA > pB && rA < rB) || (pA < pB && rA > rB)) { 
        pts = get('-VENC'); coluna = 'placar_vencedor_contrario'; ehVencNeg = true; 
    }

    if (rPen && pPen === rPen) { penal = get('PENAL'); coluna = 'placar_classificado_penaltis'; }

    const bonus = (Math.min(pA, rA) + Math.min(pB, rB)) * get('GOLS');
    const total = ((pts + bonus) * multiplicador) + penal;

    return {
        total, coluna, bonus,
        exato: ehExato, saldo: ehSaldo, venc: ehVenc, empate: ehEmpate,
        exatoNeg: ehExatoNeg, saldoNeg: ehSaldoNeg, vencNeg: ehVencNeg
    };
}

function calcularPontosRegulares(palpA, palpB, realA, realB, tabelaRegras, multiplicador = 1) {
    const pA = parseInt(palpA), pB = parseInt(palpB), rA = parseInt(realA), rB = parseInt(realB);
    const get = (sigla) => parseInt(tabelaRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0);

    let pts = 0;
    let coluna = null;
    
    // Flags de controle
    let ehExato = false, ehSaldo = false, ehVenc = false, ehEmpate = false;
    let ehExatoNeg = false, ehSaldoNeg = false, ehVencNeg = false;

    // --- ACERTOS POSITIVOS ---
    if (pA === rA && pB === rB) { pts = get('EXATO'); coluna = 'placar_exato'; ehExato = true; }
    else if (pA === pB && rA === rB) { pts = get('EMPATE'); coluna = 'placar_empate'; ehEmpate = true; }
    else if ((pA - pB) === (rA - rB)) { pts = get('SALDO'); coluna = 'placar_saldo'; ehSaldo = true; }
    else if ((pA > pB && rA > rB) || (pA < pB && rA < rB)) { pts = get('VENC'); coluna = 'placar_vencedor'; ehVenc = true; }
    
    // --- ACERTOS NEGATIVOS ---
    else if (pA === rB && pB === rA && pA !== pB) { 
        pts = get('-EXATO'); coluna = 'placar_exato_contrario'; ehExatoNeg = true; 
    }
    else if ((pB - pA) === (rA - rB)) { 
        pts = get('-SALDO'); coluna = 'placar_saldo_contrario'; ehSaldoNeg = true; 
    }
    else if ((pA > pB && rA < rB) || (pA < pB && rA > rB)) { 
        pts = get('-VENC'); coluna = 'placar_vencedor_contrario'; ehVencNeg = true; 
    }

    const bonus = (Math.min(pA, rA) + Math.min(pB, rB)) * get('GOLS');
    const total = (pts + bonus) * multiplicador;

    return { total, coluna, bonus, exato: ehExato, saldo: ehSaldo, venc: ehVenc, empate: ehEmpate, exatoNeg: ehExatoNeg, saldoNeg: ehSaldoNeg, vencNeg: ehVencNeg };
}

function calcularPontosPenaltis(penaltisPalp, penaltisReal, tabelaRegras) {
    const pPen = parseInt(penaltisPalp);
    const rPen = parseInt(penaltisReal);
    const get = (sigla) => parseInt(tabelaRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0);

    if (rPen && pPen === rPen) {
        return {
            pontos: get('PENAL'),
            coluna: 'placar_classificado_penaltis',
            acertou: true
        };
    }
    
    return { pontos: 0, coluna: null, acertou: false };
}