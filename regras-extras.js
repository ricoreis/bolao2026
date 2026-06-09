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

    // Substitua a função calcularTotalGols em regras-extras.js
    calcularTotalGols: (palpite, gabarito, pontosBase) => {
        const p = parseInt(palpite), g = parseInt(gabarito);
        if (isNaN(p) || isNaN(g)) return 0;
        const diferenca = Math.abs(p - g);
        return (diferenca === 0) ? parseInt(pontosBase) : -diferenca;
    },

    // Busca o valor de pontos configurado no banco
    obterPontos: (codigo, configRegras) => {
        const regra = configRegras.find(r => r.nome_reduzido === codigo);
        return regra ? regra.pontos : 0;
    }
};