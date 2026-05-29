var CONFIG = {
  // Master Site Base
  MASTER_BASE_APP_TOKEN:  'CBu2bJJfraK08es2cnolJbMlgFe',
  MASTER_SITE_TABLE_ID:   'tbl1vV6z4FJ2Ge07',
  MASTER_SITE_FIELD:      'SITE',
  MASTER_SITE_NAME_FIELD: 'STORE Name',
  MASTER_SM_USER_FIELD:   'STORE',       // array of {id, open_id} — Store Manager users

  // STR Management Base
  STR_BASE_APP_TOKEN:    'NU3RwtirZipu3sk9nD8l7axOgHc',
  STR_HEADER_TABLE_ID:   'tblQ7qPdqgZ6QcOg',
  STR_DETAIL_TABLE_ID:   'tbluAki3HiMe1ppg',
  STR_TYPE_TABLE_ID:     'tblfBWxKU8Fh7EMJ',
  DEPT_TABLE_ID:         'tblH112oh1QPLPiZ',

  // Status values (exact strings used in Lark Base)
  STATUS_WAITING_MGR:    'Waiting Approval by Mgr',
  STATUS_WAITING_ICO:    'Waiting Create by ICO',
  STATUS_DONE:           'Done Create STR',
  STATUS_REJECT:         'Reject',

  // ICO user open_ids — admins maintain this list manually
  ICO_USER_IDS: [],   // e.g. ['ou_xxxxxxxxxxxxxxxx', 'ou_yyyyyyyyyyyyyyyy']

  API_BASE: 'https://open.larksuite.com'
};
