function calcularPontos(palpA, palpB, realA, realB, tabelaRegras, penaltisPalp, penaltisReal, multiplicador = 1)
{
    const pA = parseInt(palpA), pB = parseInt(palpB), rA = parseInt(realA), rB = parseInt(realB);
    const pPen = parseInt(penaltisPalp);
    const rPen = parseInt(penaltisReal);
    const get = (sigla) => parseInt(tabelaRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0);

    let pts = 0;
    let penal = 0;
    let coluna = null;

    if (pA === rA && pB === rB) { pts = get('EXATO'); coluna = 'placar_exato'; }
    else if (pA === pB && rA === rB) { pts = get('EMPATE'); coluna = 'placar_empate'; }
    else if ((pA - pB) === (rA - rB)) { pts = get('SALDO'); coluna = 'placar_saldo'; }
    else if ((pA > pB && rA > rB) || (pA < pB && rA < rB)) { pts = get('VENC'); coluna = 'placar_vencedor'; }
    else if ((pA === rB && pB === rA)) { pts = get('-EXATO'); coluna = 'placar_exato_contrario'; }
    else if ((pB - pA) === (rA - rB)) { pts = get('-SALDO'); coluna = 'placar_saldo_contrario'; }
    else if ((pA > pB && rA < rB) || (pA < pB && rA > rB)) { pts = get('-VENC'); coluna = 'placar_vencedor_contrario'; }

    if (rPen && pPen === rPen) { 
        penal = get('PENAL'); 
        coluna = 'placar_classificado_penaltis'; 
    }

    const bonus = (Math.min(pA, rA) + Math.min(pB, rB)) * get('GOLS');
    const total = ((pts + bonus) * multiplicador) + penal;

    const retorno = {
        total: total,
        coluna: coluna,
        bonus: bonus
    };

    retorno.valueOf = () => total;
    retorno.toString = () => total.toString();

    return retorno;
}