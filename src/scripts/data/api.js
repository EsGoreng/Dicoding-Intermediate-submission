import { getAccessToken } from '../utils/auth';
import { BASE_URL } from '../config';

const ENDPOINTS = {
  // Auth
  REGISTER: `${BASE_URL}/register`,
  LOGIN: `${BASE_URL}/login`,

  // Stories
  STORIES: `${BASE_URL}/stories`,
  STORY_DETAIL: (id) => `${BASE_URL}/stories/${id}`,
  ADD_STORY: `${BASE_URL}/stories`,

  // Report Comment
  REPORT_COMMENTS_LIST: (reportId) => `${BASE_URL}/reports/${reportId}/comments`,
  STORE_NEW_REPORT_COMMENT: (reportId) => `${BASE_URL}/reports/${reportId}/comments`,

  // Report Comment
  SUBSCRIBE: `${BASE_URL}/notifications/subscribe`,
  UNSUBSCRIBE: `${BASE_URL}/notifications/subscribe`,
  SEND_REPORT_TO_ME: (reportId) => `${BASE_URL}/reports/${reportId}/notify-me`,
  SEND_REPORT_TO_USER: (reportId) => `${BASE_URL}/reports/${reportId}/notify`,
  SEND_REPORT_TO_ALL_USER: (reportId) => `${BASE_URL}/reports/${reportId}/notify-all`,
  SEND_COMMENT_TO_REPORT_OWNER: (reportId, commentId) =>
    `${BASE_URL}/reports/${reportId}/comments/${commentId}/notify`,
};

export async function getRegistered({ name, email, password }) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const data = JSON.stringify({ name, email, password });

  const fetchResponse = await fetch(ENDPOINTS.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data,
  });
  const json = await fetchResponse.json();

  if (!fetchResponse.ok) {
    throw new Error(json.message || 'Registration failed');
  }

  return {
    error: json.error,
    message: json.message,
    ok: fetchResponse.ok,
  };
}

export async function getLogin({ email, password }) {
  const data = JSON.stringify({ email, password });

  const fetchResponse = await fetch(ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data,
  });
  const json = await fetchResponse.json();

  if (!fetchResponse.ok) {
    throw new Error(json.message || 'Login failed');
  }

  return {
    error: json.error,
    message: json.message,
    loginResult: json.loginResult,
    ok: fetchResponse.ok,
  };
}

export async function getMyUserInfo() {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.MY_USER_INFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function getAllStories() {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.STORIES, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await fetchResponse.json();

  return {
    error: json.error,
    message: json.message,
    listStory: json.listStory,
    ok: fetchResponse.ok,
  };
}

export async function getStoryById(id) {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.STORY_DETAIL(id), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await fetchResponse.json();

  if (!fetchResponse.ok) {
    throw new Error(json.message || 'Failed to fetch story');
  }

  return {
    error: json.error,
    message: json.message,
    story: json.story,
    ok: fetchResponse.ok,
  };
}

export async function addNewStory({ description, photo, lat, lon }) {
  // Validasi ukuran file
  if (photo && photo.size > 1024 * 1024) {
    // 1MB
    throw new Error('Photo size must be less than 1MB');
  }

  const formData = new FormData();
  formData.append('description', description);
  formData.append('photo', photo);

  if (lat !== undefined && lon !== undefined) {
    formData.append('lat', lat);
    formData.append('lon', lon);
  }

  const endpoint = ENDPOINTS.ADD_STORY;
  // Always include Authorization header; guest submissions are not supported
  const fetchOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: formData,
  };

  const fetchResponse = await fetch(endpoint, fetchOptions);

  const json = await fetchResponse.json();

  if (!fetchResponse.ok) {
    throw new Error(json.message || 'Failed to add story');
  }

  return {
    error: json.error,
    message: json.message,
    ok: fetchResponse.ok,
  };
}

export async function getAllCommentsByReportId(reportId) {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.REPORT_COMMENTS_LIST(reportId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function storeNewCommentByReportId(reportId, { body }) {
  const accessToken = getAccessToken();
  const data = JSON.stringify({ body });

  const fetchResponse = await fetch(ENDPOINTS.STORE_NEW_REPORT_COMMENT(reportId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: data,
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function subscribePushNotification({ endpoint, keys: { p256dh, auth } }) {
  const accessToken = getAccessToken();
  const data = JSON.stringify({
    endpoint,
    keys: { p256dh, auth },
  });

  const fetchResponse = await fetch(ENDPOINTS.SUBSCRIBE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: data,
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function unsubscribePushNotification({ endpoint }) {
  const accessToken = getAccessToken();
  const data = JSON.stringify({
    endpoint,
  });

  const fetchResponse = await fetch(ENDPOINTS.UNSUBSCRIBE, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: data,
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function sendReportToMeViaNotification(reportId) {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.SEND_REPORT_TO_ME(reportId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function sendReportToUserViaNotification(reportId, { userId }) {
  const accessToken = getAccessToken();
  const data = JSON.stringify({
    userId,
  });

  const fetchResponse = await fetch(ENDPOINTS.SEND_REPORT_TO_USER(reportId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: data,
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function sendReportToAllUserViaNotification(reportId) {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.SEND_REPORT_TO_ALL_USER(reportId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}

export async function sendCommentToReportOwnerViaNotification(reportId, commentId) {
  const accessToken = getAccessToken();

  const fetchResponse = await fetch(ENDPOINTS.SEND_COMMENT_TO_REPORT_OWNER(reportId, commentId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await fetchResponse.json();

  return {
    ...json,
    ok: fetchResponse.ok,
  };
}
