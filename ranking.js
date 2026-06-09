import { RegrasExtras } from './regras-extras.js';

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
    const { data: palpiteDB } = await supabaseClient.from('palpites').select('palpites_grupos').eq('usuario_id', usuarioId);

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
    
    // 1. Busca Dados e Tabelas
    const [
        { data: gabaritoFinal },
        { data: paises },
        { data: jogadores },
        { data: fases }
    ] = await Promise.all([
        supabaseClient.from('resultados').select('*').single(),
        supabaseClient.from('paises').select('*'),
        supabaseClient.from('jogadores').select('*'),
        supabaseClient.from('fases').select('*')
    ]);

    const formatarValor = (tabela, id, tipo) => {
        if (id == null) return "Sem palpite";
        if (tipo === 'bruto') return id;
        const item = tabela?.find(i => parseInt(i.id) === parseInt(id));
        return item ? item.nome : `ID: ${id}`;
    };

    // 2. Inicializa o Mapa
    apostas.forEach(a => {
        if (!rankingMap[a.usuario_id]) {
            const usuarioObj = { usuario_id: a.usuario_id, nome: a.usuarios?.nome || 'Anon', pontos_totais: 0 };
            headers.forEach(h => usuarioObj[h.coluna_db] = 0);
            rankingMap[a.usuario_id] = usuarioObj;
        }
    });

    // 3. Processa Jogos (CORREÇÃO AQUI)
    jogos.forEach(jogo => {
        if (jogo.gols_a === null || jogo.gols_b === null) return;
        apostas.forEach(aposta => {
            if (String(aposta.jogo_id) === String(jogo.id)) {
                const usr = rankingMap[aposta.usuario_id];
                let mult = (parseInt(jogo.id) > 72) ? 2 : 1;
                
                const res = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, headers, mult);
                
                if (res.total > 0 || res.coluna) {
                    usr.pontos_totais += parseInt(res.total);
                    
                    // A coluna que o sistema usa para contar acertos (ex: placar_exato)
                    if (res.coluna) usr[res.coluna] = (usr[res.coluna] || 0) + 1;
                    
                    // A COLUNA DE GOLS: Somamos o bônus de gols calculados pelo regras.js
                    // Ajustamos para dividir pelo valor unitário da regra 'GOLS' para ter a contagem real
                    const valorRegraGols = parseInt(headers.find(h => h.nome_reduzido === 'GOLS')?.pontos || 1);
                    const qtdGols = res.bonus / valorRegraGols;
                    usr['placar_gols'] = (usr['placar_gols'] || 0) + qtdGols;
                }
            }
        });
    });

    // 4. Grupos, Finais e Extras (Mantido)
    const usuarios = Object.values(rankingMap);
    await Promise.all(usuarios.map(async (usr) => {
        const resG = await processarGrupos(usr.usuario_id, headers, 12);
        usr.pontos_totais += resG.total;
        usr['grupo_primeiro'] = resG.contagem[1];
        usr['grupo_segundo'] = resG.contagem[2];
        usr['grupo_terceiro'] = resG.contagem[3];
        usr['grupo_quarto'] = resG.contagem[4];
        usr['grupo_todos_primeiros'] = resG.contagem.ALL1 ? 'S' : 'N';
        usr['grupo_todos_segundos'] = resG.contagem.ALL2 ? 'S' : 'N';
        usr['grupo_todos_terceiros'] = resG.contagem.ALL3 ? 'S' : 'N';
        usr['grupo_todos_quartos'] = resG.contagem.ALL4 ? 'S' : 'N';
        usr['grupo_todos_exatos'] = resG.contagem.ALLG;

        try {
            const { data: pList } = await supabaseClient.from('palpites').select('*').eq('usuario_id', usr.usuario_id);
            const p = (pList && pList.length > 0) ? pList[0] : null;

            if (p && gabaritoFinal) {
                const mapa = [
                    { db: 'final_campeao', pal: 'campeao_id', gab: 'campeao_id', regra: 'CAMP', tipo: 'pais', tabela: paises },
                    { db: 'final_vice', pal: 'vice_id', gab: 'vice_id', regra: 'VICE', tipo: 'pais', tabela: paises },
                    { db: 'final_terceiro', pal: 'terceiro_id', gab: 'terceiro_id', regra: 'TERC', tipo: 'pais', tabela: paises },
                    { db: 'final_quarto', pal: 'quarto_id', gab: 'quarto_id', regra: 'QUAR', tipo: 'pais', tabela: paises },
                    { db: 'final_pior', pal: 'pior_time_id', gab: 'pior_time_id', regra: 'PIOR', tipo: 'pais', tabela: paises },
                    { db: 'brasil_primeiro_gol', pal: 'primeiro_gol_brasil_id', gab: 'primeiro_gol_brasil_id', regra: 'BRGOL', tipo: 'jogador', tabela: jogadores },
                    { db: 'brasil_fase_chega', pal: 'fase_brasil_id', gab: 'fase_brasil_id', regra: 'BRFASE', tipo: 'fase', tabela: fases },
                    { db: 'brasil_gols_pro', pal: 'gols_feitos_brasil', gab: 'gols_feitos_brasil', regra: 'BRG+', tipo: 'bruto', tabela: null },
                    { db: 'brasil_gols_contra', pal: 'gols_sofridos_brasil', gab: 'gols_sofridos_brasil', regra: 'BRG-', tipo: 'bruto', tabela: null },
                    { db: 'extra_pais_artilheiro', pal: 'artilheiro_pais_id', gab: 'artilheiro_pais_id', regra: 'ARTILH', tipo: 'pais', tabela: paises },
                    { db: 'extra_duelo', pal: 'duelo_gigantes', gab: 'duelo_gigantes', regra: 'CR7M10', tipo: 'bruto', tabela: null }
                ];

                const pontosMapa = { 'CAMP': 40, 'VICE': 30, 'TERC': 20, 'QUAR': 15, 'PIOR': 50, 'BRGOL': 10, 'BRFASE': 10, 'BRG+': 10, 'BRG-': 10, 'ARTILH': 20, 'CR7M10': 10 };

                mapa.forEach(m => {
                    const palpiteID = p[m.pal];
                    const gabaritoID = gabaritoFinal[m.gab];
                    const nomeExibido = formatarValor(m.tabela, palpiteID, m.tipo);

                    if (gabaritoID != null) {
                        const acertou = (palpiteID != null && String(palpiteID) === String(gabaritoID));
                        usr[m.db] = `${acertou ? 'S' : 'N'} (${nomeExibido})`;
                        if (acertou) usr.pontos_totais += parseInt(pontosMapa[m.regra] || 0);
                    } else {
                        usr[m.db] = "-";
                    }
                });
            }
        } catch (e) { console.error("Erro no processamento:", e); }
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
        const total = usr.pontos_totais || 0; 
        
        const colunasDinamicas = headers.map(h => {
            // O valor é buscado dinamicamente pela chave 'coluna_db'
            let valor = usr[h.coluna_db] ?? 0;
            
            // Debug: se o valor for 0 mas você sabe que deveria ter pontos, 
            // este log vai mostrar se a chave está a ser encontrada no objeto usr
            if (h.coluna_db === 'gols' && valor === 0) {
                console.log(`Debug GOLS: Usuário ${usr.nome} tem valor 0 na chave 'gols'`);
            }

            const colunasGrupos = ['grupo_primeiro', 'grupo_segundo', 'grupo_terceiro', 'grupo_quarto', 'grupo_todos_exatos'];
            if (colunasGrupos.includes(h.coluna_db)) valor = `${valor}/12`;
            return `<td class="px-2 py-3 text-center text-xs">${valor}</td>`;
        }).join('');

        return `<tr class="border-b border-gray-700 hover:bg-gray-700/20">
            <td class="px-4 py-3 text-center sticky left-0 bg-gray-800">${index + 1}º</td>
            <td class="px-4 py-3 sticky left-16 bg-gray-800">${usr.nome}</td>
            <td class="px-4 py-3 font-bold text-amber-400 text-center sticky left-[244px] bg-gray-800">${total}</td>
            ${colunasDinamicas}
        </tr>`;
    }).join('');
}