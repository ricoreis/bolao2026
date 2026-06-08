const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(mensagem) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensagem;
        toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300";
        setTimeout(() => toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-20 opacity-0 transition-all duration-300", 3000);
    }
}

async function carregarEstrutura() {
    console.log("--- 1. Iniciando carregamento da estrutura ---");
    const container = document.getElementById('container-grupos');
    const { data: paises, error } = await supabaseClient.from('paises').select('nome, grupo').order('grupo').order('posicao');
    
    if (error) { console.error("Erro ao carregar países:", error); return; }
    
    const grupos = paises.reduce((acc, p) => {
        if (!acc[p.grupo]) acc[p.grupo] = [];
        acc[p.grupo].push(p.nome);
        return acc;
    }, {});

    Object.entries(grupos).forEach(([letra, lista]) => {
        const clone = document.importNode(document.getElementById('template-grupo').content, true);
        clone.querySelector('.grupo-titulo').textContent = `Grupo ${letra}`;
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
    console.log("Estrutura montada com sucesso.");
    setTimeout(carregarDados, 500);
}

async function carregarDados() {
    console.log("--- 2. Iniciando carregamento de palpites e gabaritos ---");
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { console.error("Usuário não logado"); return; }

    const [p, g, r] = await Promise.all([
        supabaseClient.from('palpites').select('palpites_grupos').eq('usuario_id', user.id).single(),
        supabaseClient.from('grupos').select('*'),
        supabaseClient.from('pontuacao').select('*')
    ]);

    console.log("Palpites do usuário:", p.data?.palpites_grupos);
    console.log("Gabaritos (tabela grupos):", g.data);

    if (p.data?.palpites_grupos) {
        Object.entries(p.data.palpites_grupos).forEach(([g, paises]) => {
            Object.entries(paises).forEach(([pais, val]) => {
                const el = document.querySelector(`.grp-input[data-grupo="${g}"][data-pais="${pais}"]`);
                if (el) el.value = val;
            });
        });
    }

    if (g.data) {
        g.data.forEach(grupoDB => {
            const card = document.getElementById(`card-grupo-${grupoDB.grupo}`);
            const badge = card ? card.querySelector('.pontuacao-grupo') : null;
            if (!card || !badge) { console.warn(`Elemento não encontrado para grupo ${grupoDB.grupo}`); return; }

            try {
                const gabarito = typeof grupoDB.classificacao === 'string' ? JSON.parse(grupoDB.classificacao) : grupoDB.classificacao;
                const palpite = {};
                card.querySelectorAll('.grp-input').forEach(i => palpite[i.dataset.pais] = parseInt(i.value) || 0);

                console.log(`Grupo ${grupoDB.grupo} | Palpite:`, palpite, " | Gabarito:", gabarito);

                const pontos = RegrasGrupos.calcularPontos(palpite, gabarito, r.data || []);
                
                badge.textContent = `Pontuação: ${pontos} pts`;
                console.log(`Pontos calculados para ${grupoDB.grupo}: ${pontos}`);
            } catch (err) {
                badge.textContent = "Erro de cálculo";
                console.error("Erro ao processar grupo " + grupoDB.grupo, err);
            }
        });
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
document.addEventListener('DOMContentLoaded', carregarEstrutura);