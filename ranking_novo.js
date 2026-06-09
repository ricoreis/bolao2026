/**
 * ranking_novo.js - Motor de Processamento (Versão V2)
 */

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function encontrarIdPeloNome(nome, listaPaises) {
    const pais = listaPaises.find(p => p.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    return pais ? pais.id : nome;
}

function converterPalpitesGrupos(dados, paises) {
    if (!dados) return {};
    return Object.entries(dados).reduce((acc, [grupo, lista]) => {
        acc[grupo] = {};
        Object.entries(lista).forEach(([nomePais, posicao]) => {
            const idPais = encontrarIdPeloNome(nomePais, paises);
            acc[grupo][idPais] = posicao;
        });
        return acc;
    }, {});
}

async function gerarObjetoMestre() {
    console.log("Iniciando montagem do Objeto Mestre...");

    const [
        { data: apostas },
        { data: palpites },
        { data: usuarios },
        { data: jogos },
        { data: paises }
    ] = await Promise.all([
        supabaseClient.from('apostas').select('*'),
        supabaseClient.from('palpites').select('*'),
        supabaseClient.from('usuarios').select('*'),
        supabaseClient.from('jogos').select('*'),
        supabaseClient.from('paises').select('*')
    ]);

    const objetoMestre = usuarios.map(user => {
        const userApostas = apostas.filter(a => a.usuario_id === user.id);
        const userPalpite = palpites.find(p => p.usuario_id === user.id);

        return {
            nome: user.nome,
            usuario_id: user.id,
            apostas: Array.from({ length: 104 }, (_, i) => {
                const jogoId = i + 1;
                const aposta = userApostas.find(a => a.jogo_id === jogoId);
                return {
                    jogo_id: jogoId,
                    gols_a: aposta?.gols_a ?? null,
                    gols_b: aposta?.gols_b ?? null,
                    penaltis_vencedor_id: aposta?.penaltis_vencedor_id ?? null
                };
            }).reduce((acc, curr) => {
                acc[curr.jogo_id] = { gols_a: curr.gols_a, gols_b: curr.gols_b, penaltis: curr.penaltis_vencedor_id };
                return acc;
            }, {}),
            palpites: userPalpite ? {
                brasil: { primeiro_gol_id: userPalpite.primeiro_gol_brasil_id, fase_id: userPalpite.fase_brasil_id, gols_pro: userPalpite.gols_feitos_brasil, gols_contra: userPalpite.gols_sofridos_brasil },
                copa: { campeao_id: userPalpite.campeao_id, vice_id: userPalpite.vice_id, terceiro_id: userPalpite.terceiro_id, quarto_id: userPalpite.quarto_id, pior_id: userPalpite.pior_time_id },
                extras: { artilheiro_id: userPalpite.artilheiro_pais_id, duelos: userPalpite.duelo_gigantes }
            } : null,
            
            grupos: userPalpite?.palpites_grupos ? Object.entries(userPalpite.palpites_grupos).reduce((acc, [grupo, lista]) => {
                acc[grupo] = {};
                Object.entries(lista).forEach(([nomePais, posicao]) => {
                    const idPais = encontrarIdPeloNome(nomePais, paises); 
                    acc[grupo][idPais] = posicao;
                });
                return acc;
            }, {}) : {}
        };
    });

    console.table(objetoMestre);
    return objetoMestre;
}

async function gerarGabaritoMestre() {
    console.log("Montando Gabarito Oficial a partir da tabela 'grupos'...");

    const [
        { data: jogos },
        { data: resultados },
        { data: gruposDB }, // A tabela que realmente tem os grupos
        { data: paises }
    ] = await Promise.all([
        supabaseClient.from('jogos').select('*'),
        supabaseClient.from('resultados').select('*').eq('id', 1).single(),
        supabaseClient.from('grupos').select('*'),
        supabaseClient.from('paises').select('*')
    ]);

    // Transforma a lista de gruposDB (várias linhas) no objeto único esperado
    const gruposMestre = gruposDB.reduce((acc, g) => {
        const classif = typeof g.classificacao === 'string' ? JSON.parse(g.classificacao) : g.classificacao;
        acc[g.grupo] = {}; // g.grupo é 'A', 'B', etc.
        Object.entries(classif).forEach(([nomePais, posicao]) => {
            const idPais = encontrarIdPeloNome(nomePais, paises);
            acc[g.grupo][idPais] = posicao;
        });
        return acc;
    }, {});

    const gabarito = {
        apostas: jogos.reduce((acc, j) => {
            acc[j.id] = { gols_a: j.gols_a, gols_b: j.gols_b, penaltis: j.penaltis_vencedor_id };
            return acc;
        }, {}),
        palpites: {
            brasil: { primeiro_gol_id: resultados.primeiro_gol_brasil_id, fase_id: resultados.fase_brasil_id, gols_pro: resultados.gols_feitos_brasil, gols_contra: resultados.gols_sofridos_brasil },
            copa: { campeao_id: resultados.campeao_id, vice_id: resultados.vice_id, terceiro_id: resultados.terceiro_id, quarto_id: resultados.quarto_id, pior_id: resultados.pior_time_id },
            extras: { artilheiro_id: resultados.artilheiro_pais_id, duelos: resultados.duelo_gigantes }
        },
        grupos: gruposMestre // Agora preenchido corretamente!
    };

    console.log("Gabarito Mestre montado:", gabarito);
    return gabarito;
}

gerarObjetoMestre().then(data => window.bolaoMestre = data);
gerarGabaritoMestre().then(data => window.gabaritoMestre = data);