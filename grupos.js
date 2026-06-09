const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(mensagem) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensagem;
        
        // POSICIONAMENTO: top-5, right-5
        // ANIMAÇÃO: translate-y-[-20px] para surgir de cima (negativo)
        toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 opacity-100 translate-y-0";
        
        setTimeout(() => {
            // Ao esconder: volta para cima (translate-y-[-20px]) e opacidade 0
            toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 translate-y-[-20px] opacity-0";
        }, 3000);
    }
}

async function carregarEstrutura() {
    const container = document.getElementById('container-grupos');
    const { data: paises } = await supabaseClient.from('paises').select('nome, grupo').order('grupo').order('posicao');
    
    const grupos = paises.reduce((acc, p) => {
        if (!acc[p.grupo]) acc[p.grupo] = [];
        acc[p.grupo].push(p.nome);
        return acc;
    }, {});

    Object.entries(grupos).forEach(([letra, lista]) => {
        const clone = document.importNode(document.getElementById('template-grupo').content, true);
        clone.querySelector('.grupo-titulo').textContent = `${letra}`;
        const divPrincipal = clone.querySelector('div');
        divPrincipal.id = `card-grupo-${letra}`;
        
        const grid = clone.querySelector('.grid-inputs');
        lista.forEach(nome => {
            const iClone = document.importNode(document.getElementById('template-input-pais').content, true);
            iClone.querySelector('.nome-pais').textContent = nome;
            const input = iClone.querySelector('.grp-input');
            input.dataset.grupo = letra;
            input.dataset.pais = nome;
            grid.appendChild(iClone);
        });
        container.appendChild(clone);
    });
    
    setTimeout(carregarDados, 300);
}

async function carregarDados() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const [p, g, r] = await Promise.all([
        supabaseClient.from('palpites').select('palpites_grupos').eq('usuario_id', user.id).single(),
        supabaseClient.from('grupos').select('*'),
        supabaseClient.from('pontuacao').select('*'),
    ]);

    const TOTAL_GRUPOS = g.data ? g.data.length : 0;

    document.querySelectorAll('.pontos-individuais').forEach(s => s.textContent = '');

    if (p.data?.palpites_grupos) {
        Object.entries(p.data.palpites_grupos).forEach(([g, paises]) => {
            Object.entries(paises).forEach(([pais, val]) => {
                const el = document.querySelector(`.grp-input[data-grupo="${g}"][data-pais="${pais}"]`);
                if (el) el.value = val;
            });
        });
    }

    const contagemAcertos = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const gruposPerfeitos = [];

    if (g.data) {
        g.data.forEach(grupoDB => {
            const card = document.getElementById(`card-grupo-${grupoDB.grupo}`);
            if (!card) return;

            const gabarito = typeof grupoDB.classificacao === 'string' ? JSON.parse(grupoDB.classificacao) : grupoDB.classificacao;
            const palpite = {};
            card.querySelectorAll('.grp-input').forEach(i => palpite[i.dataset.pais] = parseInt(i.value) || 0);

            let acertosNoGrupo = 0;
            Object.entries(palpite).forEach(([pais, pos]) => {
                if (gabarito[pais] && pos === gabarito[pais]) {
                    acertosNoGrupo++;
                    contagemAcertos[pos]++;
                    const regra = r.data.find(reg => reg.nome_reduzido === `${pos}ºGRP`);
                    const inputEl = card.querySelector(`.grp-input[data-pais="${pais}"]`);
                    if (inputEl) inputEl.nextElementSibling.textContent = `+${regra ? regra.pontos : 0}`;
                }
            });
            if (acertosNoGrupo === 4) gruposPerfeitos.push(grupoDB.grupo);
        });
    }

    atualizarBoxBonus(contagemAcertos, gruposPerfeitos, r.data, TOTAL_GRUPOS);
}

function atualizarBoxBonus(contagem, gruposPerfeitos, regras, totalGrupos) {
    const listaBonus = document.getElementById('lista-bonus');
    if (!listaBonus) return;
    listaBonus.innerHTML = '';

    [1, 2, 3, 4].forEach(pos => {
        const codigo = `ALL${pos}º`; 
        const regra = regras.find(r => r.nome_reduzido === codigo);
        
        if (regra && contagem[pos] === totalGrupos) {
            const p = document.createElement('p');
            p.className = "text-yellow-400 font-bold";
            p.textContent = `+${regra.pontos} | ${regra.nome}`;
            listaBonus.appendChild(p);
        }
    });

    if (gruposPerfeitos.length > 0) {
        const regraGrupo = regras.find(r => r.nome_reduzido === 'ALLGRP');
        if (regraGrupo) {
            const totalBonus = gruposPerfeitos.length * regraGrupo.pontos;
            const p = document.createElement('p');
            p.className = "text-emerald-400 font-bold mt-2";
            const gruposOrdenados = gruposPerfeitos.sort().join(', ');
            p.textContent = `+${totalBonus} | ${regraGrupo.nome}: ${gruposOrdenados}`;
            listaBonus.appendChild(p);
        }
    }
}

async function verificarPrazo() {
    const { data: jogo } = await supabaseClient
        .from('jogos')
        .select('data_jogo')
        .eq('id', 1)
        .single();

    // 1. O Supabase sempre retorna data em ISO string (formato UTC)
    // Ao usar new Date(jogo.data_jogo), o JS cria o objeto de data corretamente
    const dataJogo = new Date(jogo.data_jogo); 
    const agora = new Date();

    // 2. getTime() retorna o número de milissegundos desde 1970 em UTC.
    // Isso é universal, não importa onde o usuário esteja!
    const tempoJogo = dataJogo.getTime();
    const tempoAgora = agora.getTime();
    
    // Duas horas em milissegundos
    const duasHorasEmMs = 2 * 60 * 60 * 1000;

    // 3. A comparação agora é matemática pura, sem fuso horário envolvido
    if ((tempoJogo - tempoAgora) < duasHorasEmMs) {
        travarInputs();
        showToast("Apostas encerradas!");
    }
}

function travarInputs() {
    const inputs = document.querySelectorAll('.grp-input');
    const btnSalvar = document.getElementById('btn-salvar-grupos');
    
    inputs.forEach(i => i.disabled = true);
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.classList.add('bg-transparent', 'cursor-not-allowed');
        btnSalvar.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'font-bold' );
        btnSalvar.textContent = "Apostas de Classificação Encerradas";
    }
}

async function salvar() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const dados = {};
    document.querySelectorAll('.grp-input').forEach(i => {
        if (!dados[i.dataset.grupo]) dados[i.dataset.grupo] = {};
        dados[i.dataset.grupo][i.dataset.pais] = parseInt(i.value) || 0;
    });
    const { error } = await supabaseClient.from('palpites').upsert({ usuario_id: user.id, palpites_grupos: dados });
    if (error) showToast("Erro ao salvar"); else { showToast("Salvo!"); carregarDados(); }
}

document.getElementById('btn-salvar-grupos').addEventListener('click', salvar);

async function iniciarPagina() {
    await carregarEstrutura();
    await verificarPrazo();
}

// document.addEventListener('DOMContentLoaded', iniciarPagina);
document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
    iniciarPagina();
});