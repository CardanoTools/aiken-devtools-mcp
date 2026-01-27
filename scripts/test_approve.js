(async () => {
  const { getProposalById, approveProposal, listProposals } = require('../dist/knowledge/proposals.js');
  const ps = await listProposals();
  console.log('Proposals count:', ps.length);
  const p = await getProposalById('aiken-lang-site');
  console.log('Found proposal aiken-lang-site? ', !!p);
  if (!p) { console.log('No proposal.'); return; }
  console.log('Proposal summary:', p.summary?.slice(0,200));
  const res = await approveProposal('aiken-lang-site', { commit: false });
  console.log('Approve result:', res);
})();
