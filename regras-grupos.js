const RegrasGrupos = {
    calcularPontos: (palpite, gabarito, configRegras) => {
        // Força a conversão para objeto caso o Supabase entregue uma string
        const gabaritoObj = typeof gabarito === 'string' ? JSON.parse(gabarito) : gabarito;
        
        let pontosTotais = 0;
        let acertos = 0;

        for (const pais in palpite) {
            // Log para você ver o que está sendo comparado no console (F12)
            console.log(`Comparando ${pais}: Palpite=${palpite[pais]} | Gabarito=${gabaritoObj[pais]}`);
            
            if (gabaritoObj.hasOwnProperty(pais) && palpite[pais] == gabaritoObj[pais]) {
                acertos++;
                const regra = configRegras.find(r => r.nome_reduzido === `${palpite[pais]}ºGRP`);
                if (regra) pontosTotais += regra.pontos;
            }
        }
        
        if (acertos === 4) {
            const bonus = configRegras.find(r => r.nome_reduzido === 'ALLGRP');
            if (bonus) pontosTotais += bonus.pontos;
        }
        return pontosTotais;
    }
};