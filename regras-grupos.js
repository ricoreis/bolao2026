/**
 * regras-grupos.js
 * Motor de cálculo de pontos para a classificação da fase de grupos.
 */

export const RegrasGrupos = {
    /**
     * @param {Object} palpite - Ex: {Brasil: 1, Marrocos: 2, Haiti: 3, Escocia: 4}
     * @param {Object} gabarito - Ex: {Brasil: 1, Marrocos: 2, Haiti: 3, Escocia: 4}
     * @param {Array} configRegras - Array vindo da tabela 'pontuacao' do Supabase
     */
    calcularPontos: (palpite, gabarito, configRegras) => {
        let pontosTotais = 0;
        let acertosPosicao = 0;

        // Itera sobre o palpite do usuário
        for (const pais in palpite) {
            const posicaoPalpite = palpite[pais];
            const posicaoGabarito = gabarito[pais];

            if (posicaoPalpite === posicaoGabarito) {
                acertosPosicao++;
                // Busca no banco quantos pontos vale acertar a posição (Ex: 1ºGRP)
                const sigla = `${posicaoPalpite}ºGRP`;
                pontosTotais += configRegras.find(r => r.nome_reduzido === sigla)?.pontos || 0;
            }
        }

        // Bônus: Se acertou as 4 posições do grupo, ganha o bônus de "Grupo Inteiro"
        if (acertosPosicao === 4) {
            pontosTotais += configRegras.find(r => r.nome_reduzido === 'ALLGRP')?.pontos || 0;
        }

        return pontosTotais;
    }
};