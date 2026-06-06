const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

function showToast(mensagem, isError = false) {
    toast.innerText = mensagem;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    setTimeout(() => { toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-20 opacity-0 transition-all duration-300"; }, 3000);
}

async function verificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: userData } = await supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single();
    if (userData) saudacaoUser.innerText = `Olá, ${userData.nome}! Preencha seus palpites.`;
    
    carregarDadosFormulario();
}

async function carregarDadosFormulario() {
    const [jogadores, fases, paises] = await Promise.all([
        supabaseClient.from('jogadores').select('id, nome, clube').order('nome'),
        supabaseClient.from('fases').select('id, nome'),
        supabaseClient.from('paises').select('id, nome').order('nome')
    ]);

    popularSelect('sel-gol', jogadores.data, (j) => `${j.nome} (${j.clube})`);
    popularSelect('sel-fase', fases.data, (f) => f.nome);
    
    // Todos os selects de países
    const paisesSelects = ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais', 'sel-finalista-1', 'sel-finalista-2'];
    paisesSelects.forEach(id => popularSelect(id, paises.data, (p) => p.nome));
    
    carregarPalpitesExistentes();
}

function popularSelect(id, dados, formatter) {
    const select = document.getElementById(id);
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    if (!dados) return;
    
    dados.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = formatter(item);
        select.appendChild(option);
    });
}

async function carregarPalpitesExistentes() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: palpite } = await supabaseClient.from('palpites').select('*').eq('usuario_id', user.id).single();
    
    if (palpite) {
        if (palpite.primeiro_gol_brasil_id) document.getElementById('sel-gol').value = palpite.primeiro_gol_brasil_id;
        if (palpite.fase_brasil_id) document.getElementById('sel-fase').value = palpite.fase_brasil_id;
        
        if (palpite.campeao_id) document.getElementById('sel-campeao').value = palpite.campeao_id;
        if (palpite.vice_id) document.getElementById('sel-vice').value = palpite.vice_id;
        if (palpite.terceiro_id) document.getElementById('sel-terceiro').value = palpite.terceiro_id;
        if (palpite.quarto_id) document.getElementById('sel-quarto').value = palpite.quarto_id;
        if (palpite.pior_time_id) document.getElementById('sel-pior').value = palpite.pior_time_id;
        if (palpite.artilheiro_pais_id) document.getElementById('sel-artilheiro-pais').value = palpite.artilheiro_pais_id;
        
        if (palpite.gols_feitos_brasil !== null) document.getElementById('inp-gols-pro').value = palpite.gols_feitos_brasil;
        if (palpite.gols_sofridos_brasil !== null) document.getElementById('inp-gols-contra').value = palpite.gols_sofridos_brasil;

        // Carregar extras do JSONB
        if (palpite.palpites_extras) {
            const extras = palpite.palpites_extras;
            if (extras.finalista_1) document.getElementById('sel-finalista-1').value = extras.finalista_1;
            if (extras.finalista_2) document.getElementById('sel-finalista-2').value = extras.finalista_2;
        }
    }
}

async function salvarPalpites() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const dados = {
        usuario_id: user.id,
        primeiro_gol_brasil_id: parseInt(document.getElementById('sel-gol').value) || null,
        fase_brasil_id: parseInt(document.getElementById('sel-fase').value) || null,
        campeao_id: parseInt(document.getElementById('sel-campeao').value) || null,
        vice_id: parseInt(document.getElementById('sel-vice').value) || null,
        terceiro_id: parseInt(document.getElementById('sel-terceiro').value) || null,
        quarto_id: parseInt(document.getElementById('sel-quarto').value) || null,
        pior_time_id: parseInt(document.getElementById('sel-pior').value) || null,
        artilheiro_pais_id: parseInt(document.getElementById('sel-artilheiro-pais').value) || null,
        gols_feitos_brasil: parseInt(document.getElementById('inp-gols-pro').value) || 0,
        gols_sofridos_brasil: parseInt(document.getElementById('inp-gols-contra').value) || 0,
        palpites_extras: {
            finalista_1: parseInt(document.getElementById('sel-finalista-1').value) || null,
            finalista_2: parseInt(document.getElementById('sel-finalista-2').value) || null
        }
    };

    const { error } = await supabaseClient.from('palpites').upsert(dados);
    if (error) showToast("Erro ao salvar: " + error.message, true);
    else showToast("Palpites salvos com sucesso!");
}

btnLogout.addEventListener('click', async () => { 
    await supabaseClient.auth.signOut(); 
    window.location.href = "index.html"; 
});

document.getElementById('btn-salvar-palpites').addEventListener('click', salvarPalpites);
document.addEventListener('DOMContentLoaded', verificarSessao);