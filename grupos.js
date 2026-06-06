const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(mensagem, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerText = mensagem;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    setTimeout(() => { toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-20 opacity-0 transition-all duration-300"; }, 3000);
}

async function carregarEstruturaGrupos() {
    const container = document.getElementById('container-grupos');
    const tempGrupo = document.getElementById('template-grupo');
    const tempInput = document.getElementById('template-input-pais');

    // Busca os países ordenados por grupo e posição diretamente do banco
    const { data: paises, error } = await supabaseClient
        .from('paises')
        .select('nome, grupo')
        .order('grupo', { ascending: true })
        .order('posicao', { ascending: true });

    if (error) return showToast("Erro ao carregar países: " + error.message, true);

    // Agrupa os países por letra de grupo
    const gruposAgrupados = paises.reduce((acc, p) => {
        if (!acc[p.grupo]) acc[p.grupo] = [];
        acc[p.grupo].push(p.nome);
        return acc;
    }, {});

    // Renderiza cada grupo
    Object.entries(gruposAgrupados).forEach(([letra, listaPaises]) => {
        const grupoClone = tempGrupo.content.cloneNode(true);
        grupoClone.querySelector('.grupo-titulo').textContent = `Grupo ${letra}`;
        
        const gridInputs = grupoClone.querySelector('.grid-inputs');
        listaPaises.forEach(nomePais => {
            const inputClone = tempInput.content.cloneNode(true);
            inputClone.querySelector('.nome-pais').textContent = nomePais;
            const input = inputClone.querySelector('.grp-input');
            input.dataset.grupo = letra;
            input.dataset.pais = nomePais;
            gridInputs.appendChild(inputClone);
        });
        container.appendChild(grupoClone);
    });

    carregarPalpitesExistentes();
}

async function carregarPalpitesExistentes() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: palpite } = await supabaseClient.from('palpites').select('palpites_grupos').eq('usuario_id', user.id).single();
    
    if (palpite && palpite.palpites_grupos) {
        const dados = palpite.palpites_grupos;
        document.querySelectorAll('.grp-input').forEach(input => {
            const g = input.dataset.grupo;
            const p = input.dataset.pais;
            if (dados[g] && dados[g][p]) input.value = dados[g][p];
        });
    }
}

async function salvarGrupos() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const dadosGrupos = {};

    document.querySelectorAll('.grp-input').forEach(input => {
        const g = input.dataset.grupo;
        const p = input.dataset.pais;
        if (!dadosGrupos[g]) dadosGrupos[g] = {};
        dadosGrupos[g][p] = parseInt(input.value) || 0;
    });

    const { error } = await supabaseClient.from('palpites').upsert({
        usuario_id: user.id,
        palpites_grupos: dadosGrupos
    });

    if (error) showToast("Erro ao salvar: " + error.message, true);
    else showToast("Grupos salvos com sucesso!");
}

document.getElementById('btn-salvar-grupos').addEventListener('click', salvarGrupos);
document.addEventListener('DOMContentLoaded', carregarEstruturaGrupos);