//! Local registry: which sockets on this instance belong to which user.

use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::mpsc;

/// A message for one connection's writer task.
#[derive(Debug, Clone)]
pub enum Outbound {
    Bytes(Vec<u8>),
    Close(u16),
}

struct Entry {
    id: u64,
    session: String,
    sender: mpsc::Sender<Outbound>,
}

#[derive(Default)]
pub struct Hub {
    next_id: AtomicU64,
    users: Mutex<HashMap<String, Vec<Entry>>>,
}

impl Hub {
    pub fn register(&self, user_id: &str, session: &str, sender: mpsc::Sender<Outbound>) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.users
            .lock()
            .expect("hub lock")
            .entry(user_id.to_string())
            .or_default()
            .push(Entry {
                id,
                session: session.to_string(),
                sender,
            });
        id
    }

    /// Closes the sockets opened with one session (one device signing out).
    pub fn close_session(&self, session: &str, code: u16) {
        let users = self.users.lock().expect("hub lock");
        for entry in users.values().flatten().filter(|e| e.session == session) {
            let _ = entry.sender.try_send(Outbound::Close(code));
        }
    }

    pub fn unregister(&self, user_id: &str, id: u64) {
        let mut users = self.users.lock().expect("hub lock");
        if let Some(list) = users.get_mut(user_id) {
            list.retain(|e| e.id != id);
            if list.is_empty() {
                users.remove(user_id);
            }
        }
    }

    /// Queues a message for every local socket of a user. A full queue means a
    /// stalled client: the message is dropped, never blocking everyone else.
    pub fn send(&self, user_id: &str, message: Outbound) {
        let users = self.users.lock().expect("hub lock");
        if let Some(list) = users.get(user_id) {
            for entry in list {
                let _ = entry.sender.try_send(message.clone());
            }
        }
    }

    pub fn connections(&self) -> usize {
        self.users
            .lock()
            .expect("hub lock")
            .values()
            .map(Vec::len)
            .sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delivers_per_user_and_closes_per_session() {
        let hub = Hub::default();
        let (tx1, mut rx1) = mpsc::channel(4);
        let (tx2, mut rx2) = mpsc::channel(4);
        let (tx3, mut rx3) = mpsc::channel(4);
        let a1 = hub.register("alice", "s1", tx1);
        hub.register("alice", "s2", tx2);
        hub.register("bob", "s3", tx3);
        hub.send("alice", Outbound::Bytes(vec![1]));
        assert!(matches!(rx1.try_recv(), Ok(Outbound::Bytes(b)) if b == vec![1]));
        assert!(matches!(rx2.try_recv(), Ok(Outbound::Bytes(_))));
        assert!(rx3.try_recv().is_err());
        hub.close_session("s2", 4000);
        assert!(matches!(rx2.try_recv(), Ok(Outbound::Close(4000))));
        assert!(rx1.try_recv().is_err());
        hub.unregister("alice", a1);
        assert_eq!(hub.connections(), 2);
    }
}
