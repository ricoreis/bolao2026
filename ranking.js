const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', carregarRanking);

async function carregarRanking() {
    try {
        const [
            { data: headers },
            { data: apostas },
            { data: jogos }
        ] = await Promise.all([
            supabaseClient.from('pontuacao').select('*').order('id'),
            supabaseClient.from('apostas').select('*, usuarios(nome)'),
            supabaseClient.from('jogos').select('*')
        ]);

        const rankingFinal = await processarRanking(apostas, jogos, headers);
        renderizarTabela(rankingFinal, headers);
    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
    }
}

async function processarGrupos(usuarioId, regras, totalGrupos) {
    const { data: gabaritos } = await supabaseClient.from('grupos').select('*');
    const { data: palpiteDB } = await supabaseClient.from('palpites')
        .select('palpites_grupos').eq('usuario_id', usuarioId);

    if (!gabaritos || !palpiteDB || palpiteDB.length === 0) return { total: 0, contagem: {1:0, 2:0, 3:0, 4:0, ALL1: 0, ALL2: 0, ALL3: 0, ALL4: 0, ALLG: 0} };

    const palpites = palpiteDB[0].palpites_grupos;
    let pontosGrupo = 0;
    const contagem = { 1: 0, 2: 0, 3: 0, 4: 0, ALL1: 0, ALL2: 0, ALL3: 0, ALL4: 0, ALLG: 0 };
    let gruposPerfeitos = 0;

    gabaritos.forEach(g => {
        if (!g.classificacao) return;
        const gab = typeof g.classificacao === 'string' ? JSON.parse(g.classificacao) : g.classificacao;
        const palpiteGrupo = palpites[g.grupo] || {};
        let acertosNoGrupo = 0;

        Object.entries(gab).forEach(([pais, posicaoReal]) => {
            const posicaoPalpite = palpiteGrupo[pais];
            if (posicaoPalpite !== undefined && posicaoReal === posicaoPalpite) {
                acertosNoGrupo++;
                if (contagem.hasOwnProperty(posicaoPalpite)) contagem[posicaoPalpite]++;
                const regra = regras.find(r => r.nome_reduzido === `${posicaoPalpite}ºGRP`);
                if (regra) pontosGrupo += parseInt(regra.pontos || 0);
            }
        });
        if (acertosNoGrupo === 4) {
            gruposPerfeitos++;
            contagem.ALLG++;
        }
    });

    [1, 2, 3, 4].forEach(pos => {
        if (contagem[pos] === totalGrupos) {
            contagem['ALL' + pos] = 1;
            const regra = regras.find(r => r.nome_reduzido === `ALL${pos}º`);
            if (regra) pontosGrupo += parseInt(regra.pontos || 0);
        }
    });

    const regraAllGrp = regras.find(r => r.nome_reduzido === 'ALLGRP');
    if (regraAllGrp) pontosGrupo += (gruposPerfeitos * parseInt(regraAllGrp.pontos || 0));

    return { total: pontosGrupo, contagem: contagem };
}

async function processarRanking(apostas, jogos, headers) {
    const rankingMap = {};
    apostas.forEach(a => {
        if (!rankingMap[a.usuario_id]) {
            const usuarioObj = { usuario_id: a.usuario_id, nome: a.usuarios?.nome || 'Anon', pontos_totais: 0 };
            headers.forEach(h => usuarioObj[h.coluna_db] = 0);
            rankingMap[a.usuario_id] = usuarioObj;
        }
    });

    jogos.forEach(jogo => {
        if (jogo.gols_a === null || jogo.gols_b === null) return;
        apostas.forEach(aposta => {
            if (String(aposta.jogo_id) === String(jogo.id)) {
                const usr = rankingMap[aposta.usuario_id];
                let mult = (parseInt(jogo.id) > 72) ? 2 : 1;
                const res = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, headers, mult);
                if (res.total > 0 || res.coluna) {
                    usr.pontos_totais += parseInt(res.total);
                    if (res.coluna) usr[res.coluna] = (usr[res.coluna] || 0) + 1;
                    if (res.bonus > 0 && usr.hasOwnProperty('placar_gols')) usr.placar_gols = (usr.placar_gols || 0) + res.bonus;
                }
            }
        });
    });

    const usuarios = Object.values(rankingMap);
    await Promise.all(usuarios.map(async (usr) => {
        const resG = await processarGrupos(usr.usuario_id, headers, 12);
        usr.pontos_totais += resG.total;
        
        // Chaves que você definiu no banco (coluna_db)
        usr['grupo_primeiro'] = resG.contagem[1];
        usr['grupo_segundo'] = resG.contagem[2];
        usr['grupo_terceiro'] = resG.contagem[3];
        usr['grupo_quarto'] = resG.contagem[4];
        
        // Conversão para S/N
        usr['grupo_todos_primeiros'] = resG.contagem.ALL1 ? 'S' : 'N';
        usr['grupo_todos_segundos'] = resG.contagem.ALL2 ? 'S' : 'N';
        usr['grupo_todos_terceiros'] = resG.contagem.ALL3 ? 'S' : 'N';
        usr['grupo_todos_quartos'] = resG.contagem.ALL4 ? 'S' : 'N';
        usr['grupo_todos_exatos'] = resG.contagem.ALLG;
    }));

    return usuarios.sort((a, b) => b.pontos_totais - a.pontos_totais);
}

function renderizarTabela(dados, headers) {
    const thead = document.querySelector('thead tr');
    const tbody = document.getElementById('container-ranking');
    if (!thead || !tbody) return;

    while (thead.children.length > 3) thead.removeChild(thead.lastChild);
    headers.forEach(h => {
        const th = document.createElement('th');
        th.className = "px-4 py-4 text-center text-xs text-emerald-400 uppercase";
        th.innerText = h.nome_reduzido;
        thead.appendChild(th);
    });

    tbody.innerHTML = dados.map((usr, index) => {
        const total = isNaN(usr.pontos_totais) ? 0 : usr.pontos_totais;
        const colunasDinamicas = headers.map(h => {
            // Tenta buscar pelo coluna_db, se for nulo busca o próprio nome caso injetado manualmente
            const valor = usr[h.coluna_db] ?? 0;
            return `<td class="px-4 py-3 text-center">${valor}</td>`;
        }).join('');

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-700/20">
            <td class="px-4 py-3 text-center sticky left-0 bg-gray-800">${index + 1}º</td>
            <td class="px-4 py-3 sticky left-16 bg-gray-800">${usr.nome}</td>
            <td class="px-4 py-3 font-bold text-amber-400 text-center sticky left-[244px] bg-gray-800">${total}</td>
            ${colunasDinamicas}
        </tr>`;
    }).join('');
}