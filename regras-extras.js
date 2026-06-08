export const RegrasExtras = {
    // Acerto exato (IDs ou Valores numéricos)
    calcularSimples: (palpite, gabarito, pontosBase) => {
        return (parseInt(palpite) === parseInt(gabarito)) ? pontosBase : 0;
    },

    // Duelo Gigantes (String)
    calcularDueloGigantes: (palpite, gabarito, pontosBase) => {
        // Aqui comparamos a string diretamente, sem parseInt
        return (palpite === gabarito) ? pontosBase : 0;
    },

    // Total de Gols (Regra de aproximação)
    calcularTotalGols: (palpite, gabarito, pontosBase) => {
        const p = parseInt(palpite);
        const g = parseInt(gabarito);
        if (isNaN(p) || isNaN(g)) return 0;
        const diferenca = Math.abs(p - g);
        if (diferenca === 0) return pontosBase;
        if (diferenca <= 5) return Math.floor(pontosBase * 0.7);
        if (diferenca <= 10) return Math.floor(pontosBase * 0.4);
        if (diferenca <= 20) return Math.floor(pontosBase * 0.2);
        return 0;
    },

    // Busca o valor de pontos configurado no banco
    obterPontos: (codigo, configRegras) => {
        const regra = configRegras.find(r => r.nome_reduzido === codigo);
        return regra ? regra.pontos : 0;
    }
};